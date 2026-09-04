from typing import Dict, Any, List
from threading import Lock

_ocr = None
_lock = Lock()


def get_ocr():
    """Lazy PaddleOCR singleton - initialised on first use so the API can start
    without loading the OCR models."""
    global _ocr
    if _ocr is None:
        with _lock:
            if _ocr is None:
                from paddleocr import PaddleOCR

                _ocr = PaddleOCR(use_textline_orientation=True, lang="en")
    return _ocr


def run_ocr(image_path: str) -> Dict[str, Any]:
    """Run PaddleOCR on an image and return normalised text/confidence/bbox lists."""
    ocr = get_ocr()
    result = ocr.predict(image_path)

    texts: List[str] = []
    confidences: List[float] = []
    bounding_boxes: List[List[List[int]]] = []

    if result and len(result) > 0:
        data = result[0]
        rec_texts = data.get("rec_texts", [])
        rec_scores = data.get("rec_scores", [])
        rec_polys = data.get("rec_polys", [])
        for text, conf, bbox in zip(rec_texts, rec_scores, rec_polys):
            texts.append(text)
            confidences.append(float(conf))
            bounding_boxes.append(bbox.tolist() if hasattr(bbox, "tolist") else bbox)

    return {
        "texts": texts,
        "confidences": confidences,
        "bounding_boxes": bounding_boxes,
        "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else 0.0,
    }
