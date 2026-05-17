import json
import os
import sys

from pdf_extractor import PDFExtractor
from ai_processor import ScheduleProcessor


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else ""
    if not pdf_path or not os.path.exists(pdf_path):
        print(json.dumps({"ok": False, "error": "PDF file not found"}))
        return 1

    try:
        text_content = PDFExtractor.extract_as_text(pdf_path)
        if not text_content or not text_content.strip():
            print(json.dumps({"ok": False, "error": "Failed to extract text from PDF"}))
            return 1

        response = ScheduleProcessor.process_schedule_text(text_content)
        courses = ScheduleProcessor.parse_json_response(response)
        print(json.dumps({"ok": True, "courses": courses}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
