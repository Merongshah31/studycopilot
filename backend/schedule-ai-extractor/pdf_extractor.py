import pdfplumber
from PIL import Image
import os

class PDFExtractor:
    @staticmethod
    def extract_as_text(pdf_path):
        """Extract text from PDF"""
        text_content = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    text_content += f"\n--- Page {page_num + 1} ---\n"
                    
                    # Extract text
                    text = page.extract_text()
                    if text:
                        text_content += text
                    
                    # Try to extract tables
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            text_content += "\n[TABLE]\n"
                            for row in table:
                                text_content += " | ".join(str(cell) if cell else "" for cell in row) + "\n"
        except Exception as e:
            print(f"Error extracting text: {e}")
        return text_content
    
    @staticmethod
    def save_image(image, output_path="temp_schedule.png"):
        """Placeholder - not used without pdf2image"""
        pass