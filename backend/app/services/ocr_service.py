import os
import tempfile
from typing import Dict, Any, List, Optional
from threading import Lock
from PIL import Image

_ocr = None
_lock = Lock()

# Max dimension for image resizing before OCR inference.
# Resizing high-res photos (3000x4000) to max 1600px reduces pixel count by 6x
# and speeds up OCR processing dramatically with zero loss of extraction accuracy.
OCR_MAX_DIMENSION = int(os.environ.get("OCR_MAX_DIMENSION", "1600"))

# When avg confidence falls below this threshold, trigger the enhanced retry
# path: upscale + contrast enhancement + sharpening before re-running OCR.
OCR_RETRY_CONFIDENCE_THRESHOLD = float(os.environ.get("OCR_RETRY_CONFIDENCE_THRESHOLD", "0.75"))

# Minimum line count below which we consider OCR "low yield" and trigger retry
OCR_RETRY_MIN_LINES = int(os.environ.get("OCR_RETRY_MIN_LINES", "2"))

# PaddlePaddle 3.3.x crashes inside its oneDNN kernels on the PP-OCRv6
# detection model:
#     NotImplementedError: (Unimplemented) ConvertPirAttribute2RuntimeAttribute
#     not support [pir::ArrayAttribute<pir::DoubleAttribute>]
# Disabling oneDNN runs the same model through the standard CPU kernels and
# produces correct results. Kept configurable so it can be re-enabled once the
# upstream bug is fixed: set OCR_ENABLE_MKLDNN=true.
OCR_ENABLE_MKLDNN = os.environ.get("OCR_ENABLE_MKLDNN", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

OCR_DEVICE = os.environ.get("OCR_DEVICE", "auto").strip().lower()

# Model profile.
OCR_PROFILE = os.environ.get("OCR_PROFILE", "fast").strip().lower()

# Orientation classification costs extra time per image. Off by default.
OCR_TEXTLINE_ORIENTATION = os.environ.get(
    "OCR_TEXTLINE_ORIENTATION", "false"
).strip().lower() in ("1", "true", "yes", "on")

_FAST_MODELS = {
    "text_detection_model_name": "PP-OCRv5_mobile_det",
    "text_recognition_model_name": "PP-OCRv5_mobile_rec",
}

# Per-line confidence thresholds for OCR status taxonomy
_OCR_STATUS_HIGH = 0.90   # FOUND
_OCR_STATUS_LOW  = 0.65   # below → UNREADABLE, between → FOUND_LOW_CONFIDENCE


def get_ocr():
    """Lazy PaddleOCR singleton - initialised on first use so the API can start
    without loading the OCR models."""
    global _ocr
    if _ocr is None:
        with _lock:
            if _ocr is None:
                from paddleocr import PaddleOCR

                kwargs = {
                    "use_textline_orientation": OCR_TEXTLINE_ORIENTATION,
                    "use_doc_orientation_classify": False,
                    "use_doc_unwarping": False,
                    "lang": "en",
                    "enable_mkldnn": OCR_ENABLE_MKLDNN,
                }
                if OCR_DEVICE and OCR_DEVICE != "auto" and OCR_DEVICE != "cpu":
                    kwargs["device"] = OCR_DEVICE
                if OCR_PROFILE == "fast":
                    kwargs.update(_FAST_MODELS)
                _ocr = PaddleOCR(**kwargs)
    return _ocr


def _prepare_image(image_path: str) -> tuple[str, float, bool]:
    """Resize image to OCR_MAX_DIMENSION if it exceeds it to speed up inference."""
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            max_dim = max(width, height)
            if OCR_MAX_DIMENSION > 0 and max_dim > OCR_MAX_DIMENSION:
                scale = OCR_MAX_DIMENSION / float(max_dim)
                new_w = int(width * scale)
                new_h = int(height * scale)
                resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

                temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                temp_path = temp_file.name
                temp_file.close()

                resized.convert("RGB").save(temp_path, quality=95)
                return temp_path, scale, True
    except Exception:
        pass
    return image_path, 1.0, False


def _enhance_for_ocr(image_path: str) -> Optional[str]:
    """Apply contrast enhancement, sharpening and upscaling to improve OCR on
    difficult images (dot-matrix, low contrast, small text).

    Returns path to a temp file (caller must delete) or None if enhancement
    failed. Enhancement is intentionally conservative: we apply CLAHE for
    contrast, a mild unsharp mask for sharpening, and a 1.5x upscale so small
    text becomes more legible without introducing artefacts.
    """
    try:
        import cv2
        import numpy as np
        img = cv2.imread(image_path)
        if img is None:
            return None

        # 1. Upscale (1.5x) — helps small/dot-matrix text
        h, w = img.shape[:2]
        img = cv2.resize(img, (int(w * 1.5), int(h * 1.5)), interpolation=cv2.INTER_CUBIC)

        # 2. CLAHE contrast enhancement on luminance channel
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_chan, a_chan, b_chan = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l_chan)
        lab = cv2.merge([l_enhanced, a_chan, b_chan])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

        # 3. Unsharp mask (mild sharpening)
        blur = cv2.GaussianBlur(img, (0, 0), 3)
        img = cv2.addWeighted(img, 1.5, blur, -0.5, 0)

        temp_file = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        temp_path = temp_file.name
        temp_file.close()
        cv2.imwrite(temp_path, img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return temp_path
    except Exception:
        return None


def _ocr_status(confidence: float) -> str:
    """Map a per-line OCR confidence score to a readability status string."""
    if confidence >= _OCR_STATUS_HIGH:
        return "FOUND"
    if confidence >= _OCR_STATUS_LOW:
        return "FOUND_LOW_CONFIDENCE"
    return "UNREADABLE"


def _parse_result(result, scale: float) -> Dict[str, Any]:
    """Convert raw PaddleOCR output to normalised text/confidence/bbox lists."""
    texts: List[str] = []
    confidences: List[float] = []
    bounding_boxes: List[List[List[int]]] = []
    statuses: List[str] = []

    if result and len(result) > 0:
        data = result[0]
        rec_texts = data.get("rec_texts", [])
        rec_scores = data.get("rec_scores", [])
        rec_polys = data.get("rec_polys", [])
        for text, conf, bbox in zip(rec_texts, rec_scores, rec_polys):
            conf_f = float(conf)
            texts.append(text)
            confidences.append(conf_f)
            statuses.append(_ocr_status(conf_f))
            raw_box = bbox.tolist() if hasattr(bbox, "tolist") else bbox
            if scale != 1.0 and scale > 0:
                scaled_box = [[int(pt[0] / scale), int(pt[1] / scale)] for pt in raw_box]
                bounding_boxes.append(scaled_box)
            else:
                bounding_boxes.append(raw_box)

    avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
    return {
        "texts": texts,
        "confidences": confidences,
        "bounding_boxes": bounding_boxes,
        "statuses": statuses,
        "avg_confidence": avg_conf,
    }


def run_ocr(image_path: str) -> Dict[str, Any]:
    """Run PaddleOCR on an image and return normalised text/confidence/bbox lists.

    Enhancement retry: if the first pass produces low average confidence or
    very few text lines, the image is preprocessed (CLAHE + sharpen + upscale)
    and OCR is run again. The better result (by avg_confidence × line_count
    score) is returned. This handles dot-matrix base printing, low-contrast
    labels, small text, and curved can text without any model changes.
    """
    ocr = get_ocr()
    proc_path, scale, is_temp = _prepare_image(image_path)

    try:
        raw = ocr.predict(proc_path)
    finally:
        if is_temp and os.path.exists(proc_path):
            try:
                os.remove(proc_path)
            except Exception:
                pass

    first_result = _parse_result(raw, scale)
    retry_used = False
    preprocessing_applied = False

    # Decide whether to trigger the enhancement retry
    low_conf = first_result["avg_confidence"] < OCR_RETRY_CONFIDENCE_THRESHOLD
    low_yield = len(first_result["texts"]) < OCR_RETRY_MIN_LINES

    if low_conf or low_yield:
        enhanced_path = _enhance_for_ocr(image_path)
        if enhanced_path:
            try:
                enh_proc_path, enh_scale, enh_is_temp = _prepare_image(enhanced_path)
                try:
                    enh_raw = ocr.predict(enh_proc_path)
                finally:
                    if enh_is_temp and os.path.exists(enh_proc_path):
                        try:
                            os.remove(enh_proc_path)
                        except Exception:
                            pass
                enh_result = _parse_result(enh_raw, enh_scale)

                # Score = avg_conf × sqrt(line_count) — more lines is better
                # but we don't want to reward a noisy result that found random
                # fragments with low confidence over a clean sparse one.
                def score(r: Dict) -> float:
                    return r["avg_confidence"] * (len(r["texts"]) ** 0.5)

                if score(enh_result) > score(first_result):
                    first_result = enh_result
                    retry_used = True
                    preprocessing_applied = True
            except Exception:
                pass
            finally:
                if os.path.exists(enhanced_path):
                    try:
                        os.remove(enhanced_path)
                    except Exception:
                        pass

    first_result["retry_used"] = retry_used
    first_result["preprocessing_applied"] = preprocessing_applied
    return first_result
