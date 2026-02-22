import sys
import PyPDF2

def extract_text(pdf_path):
    text = ""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    out_path = sys.argv[2]
    text = extract_text(pdf_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Extracted to {out_path}")
