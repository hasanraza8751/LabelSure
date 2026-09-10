"""OCR enhancement and status taxonomy regression tests.

Tests the enhanced ocr_service.py:
  - Per-line status taxonomy (FOUND / FOUND_LOW_CONFIDENCE / UNREADABLE)
  - Retry/preprocessing metadata flags
  - Graceful handling of edge cases
"""

import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["LABELSURE_DISABLE_DOTENV"] = "1"
os.environ.setdefault("DATABASE_URL", "sqlite:///test_ocr_enh.db")

import pytest

from backend.app.services import ocr_service


class TestOCRStatusTaxonomy:
    """Tests for the per-line status taxonomy function."""

    def test_high_confidence_is_found(self):
        status = ocr_service._ocr_status(0.95)
        assert status == "FOUND"

    def test_exactly_at_high_threshold_is_found(self):
        status = ocr_service._ocr_status(0.90)
        assert status == "FOUND"

    def test_between_thresholds_is_found_low_confidence(self):
        status = ocr_service._ocr_status(0.80)
        assert status == "FOUND_LOW_CONFIDENCE"

    def test_exactly_at_low_threshold_is_found_low_confidence(self):
        status = ocr_service._ocr_status(0.65)
        assert status == "FOUND_LOW_CONFIDENCE"

    def test_below_low_threshold_is_unreadable(self):
        status = ocr_service._ocr_status(0.50)
        assert status == "UNREADABLE"

    def test_zero_confidence_is_unreadable(self):
        status = ocr_service._ocr_status(0.0)
        assert status == "UNREADABLE"

    def test_perfect_confidence_is_found(self):
        status = ocr_service._ocr_status(1.0)
        assert status == "FOUND"


class TestOCRResultMetadataFlags:
    """Tests that run_ocr returns the expected metadata flags."""

    def _make_fake_ocr_result(self, texts, scores):
        """Build a fake PaddleOCR output structure."""
        import numpy as np
        polys = [
            np.array([[0, i*50], [200, i*50], [200, i*50+30], [0, i*50+30]])
            for i in range(len(texts))
        ]
        return [{
            "rec_texts": texts,
            "rec_scores": scores,
            "rec_polys": polys,
        }]

    def test_retry_used_false_on_good_image(self):
        """High-confidence result → retry_used=False, preprocessing_applied=False."""
        fake_result = self._make_fake_ocr_result(
            ["MRP Rs. 45.00", "Net Wt: 200g"],
            [0.96, 0.97],
        )
        with patch.object(ocr_service, "get_ocr") as mock_get_ocr:
            mock_ocr = MagicMock()
            mock_ocr.predict.return_value = fake_result
            mock_get_ocr.return_value = mock_ocr
            result = ocr_service.run_ocr("fake_image.jpg")

        assert result["retry_used"] is False
        assert result["preprocessing_applied"] is False

    def test_statuses_list_has_same_length_as_texts(self):
        """statuses list must be parallel to texts list."""
        fake_result = self._make_fake_ocr_result(
            ["Line 1", "Line 2", "Line 3"],
            [0.95, 0.75, 0.45],
        )
        with patch.object(ocr_service, "get_ocr") as mock_get_ocr:
            mock_ocr = MagicMock()
            mock_ocr.predict.return_value = fake_result
            mock_get_ocr.return_value = mock_ocr
            result = ocr_service.run_ocr("fake_image.jpg")

        assert len(result["statuses"]) == len(result["texts"]) == 3

    def test_statuses_reflect_per_line_confidence(self):
        """Mixed confidence → correct per-line status classification."""
        fake_result = self._make_fake_ocr_result(
            ["High conf line", "Mid conf line", "Low conf line"],
            [0.95, 0.75, 0.45],
        )
        with patch.object(ocr_service, "get_ocr") as mock_get_ocr:
            mock_ocr = MagicMock()
            mock_ocr.predict.return_value = fake_result
            mock_get_ocr.return_value = mock_ocr
            result = ocr_service.run_ocr("fake_image.jpg")

        assert result["statuses"][0] == "FOUND"
        assert result["statuses"][1] == "FOUND_LOW_CONFIDENCE"
        assert result["statuses"][2] == "UNREADABLE"

    def test_empty_result_has_zero_avg_confidence(self):
        """Empty OCR result must return avg_confidence=0.0 and empty statuses."""
        with patch.object(ocr_service, "get_ocr") as mock_get_ocr:
            mock_ocr = MagicMock()
            mock_ocr.predict.return_value = [{"rec_texts": [], "rec_scores": [], "rec_polys": []}]
            mock_get_ocr.return_value = mock_ocr
            result = ocr_service.run_ocr("fake_empty.jpg")

        assert result["avg_confidence"] == 0.0
        assert result["texts"] == []
        assert result["statuses"] == []

    def test_backward_compatible_keys_present(self):
        """All original output keys must still be present for downstream compatibility."""
        fake_result = self._make_fake_ocr_result(["Test line"], [0.92])
        with patch.object(ocr_service, "get_ocr") as mock_get_ocr:
            mock_ocr = MagicMock()
            mock_ocr.predict.return_value = fake_result
            mock_get_ocr.return_value = mock_ocr
            result = ocr_service.run_ocr("fake_image.jpg")

        required_keys = {"texts", "confidences", "bounding_boxes", "avg_confidence"}
        assert required_keys <= set(result.keys()), (
            f"Missing backward-compatible keys: {required_keys - set(result.keys())}"
        )
        # New keys from enhancement
        assert "statuses" in result
        assert "retry_used" in result
        assert "preprocessing_applied" in result


class TestEnhancementRetryPath:
    """Tests for the enhancement/retry path logic."""

    def test_enhance_for_ocr_returns_none_on_bad_path(self):
        """_enhance_for_ocr on a non-existent file must return None, not raise."""
        result = ocr_service._enhance_for_ocr("/nonexistent/path/image.jpg")
        assert result is None

    def test_parse_result_returns_correct_structure(self):
        """_parse_result must return all required keys."""
        import numpy as np
        fake_raw = [{
            "rec_texts": ["hello"],
            "rec_scores": [0.92],
            "rec_polys": [np.array([[0, 0], [100, 0], [100, 30], [0, 30]])],
        }]
        result = ocr_service._parse_result(fake_raw, scale=1.0)
        assert result["texts"] == ["hello"]
        assert result["confidences"] == [0.92]
        assert len(result["bounding_boxes"]) == 1
        assert result["statuses"] == ["FOUND"]
        assert result["avg_confidence"] == 0.92
