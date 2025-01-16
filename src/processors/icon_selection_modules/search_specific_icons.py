from abc import ABC, abstractmethod
from sentence_transformers import SentenceTransformer
import os, json, faiss
import numpy as np

os.environ["TOKENIZERS_PARALLELISM"] = "false"

class SpecificIcons(ABC):
    @abstractmethod
    def search(self, text: str) -> dict:
        pass

    @abstractmethod
    def search_and_save(self, text: str, output_path: str, width: int, height: int) -> str:
        pass

flag_path = '/data1/jiashu/data/flag_icons'
model_path = "/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"
logo_path = '/data1/jiashu/data/logo_icons/images/svg'

def svg_to_png(svg_path, output_path, width, height):
    """
    Convert SVG to PNG with specified dimensions
    
    Args:
        svg_path (str): Path to input SVG file
        output_path (str): Path for output PNG file  
        width (int): Target width in pixels
        height (int): Target height in pixels
    """
    from cairosvg import svg2png
    
    # Convert SVG to PNG with specified dimensions
    svg2png(url=svg_path, 
            write_to=output_path,
            output_width=width,
            output_height=height)

class FlagIcons(SpecificIcons):
    def __init__(self):
        self.name = 'Flag Icons'
        self.model = SentenceTransformer(model_path)
        self.__load_countries()
        self.country_embeddings = self.__create_embeddings(self.country_names)
        self.index = faiss.IndexFlatIP(self.country_embeddings.shape[1])
        self.index.add(self.country_embeddings)

    def __load_countries(self):
        with open(os.path.join(flag_path, 'country.json')) as f:
            data = json.load(f)
        self.country_data = data
        self.country_names = [item['name'] for item in data]

    def __create_embeddings(self, texts):
        embeddings = self.model.encode(texts)
        return embeddings

    def __find_best_match(self, text_embedding):
        D, I = self.index.search(np.array([text_embedding]), 1)
        return I[0][0]

    def search(self, text: str) -> dict:
        text_embedding = self.__create_embeddings([text])[0]
        best_match_index = self.__find_best_match(text_embedding)
        return self.country_data[best_match_index]

    def search_and_save(self, text: str, output_path: str, width: int, height: int) --> str:
        result = self.search(text)
        image = result['flag_1x1'] if width == height else result['flag_4x3']
        file_name = image.split('/')[-1]
        svg_path = os.path.join(flag_path, image)
        output_file = os.path.join(flag_path, file_name)
        svg_to_png(svg_path, output_file, width, height)
        return output_file

class logo_icons(SpecificIcons):
    def __init__(self):
        self.name = 'Logo Icons'
        self.model = SentenceTransformer(model_path)
        self.__load_logos()
        self.logo_embeddings = self.__create_embeddings(self.logo_names)
        self.index = faiss.IndexFlatIP(self.logo_embeddings.shape[1])
        self.index.add(self.logo_embeddings)

    def __load_logos(self):
        logo_names = os.listdir(logo_path)
        self.logo_names = [name.split('.')[0] for name in logo_names if name.endswith('.svg')]

    def __create_embeddings(self, texts):
        embeddings = self.model.encode(texts)
        return embeddings

    def __find_best_match(self, text_embedding):
        D, I = self.index.search(np.array([text_embedding]), 1)
        return I[0][0]

    def search(self, text: str) -> dict:
        text_embedding = self.__create_embeddings([text])[0]
        best_match_index = self.__find_best_match(text_embedding)
        return self.logo_names[best_match_index]

    def search_and_save(self, text: str, output_path: str, width: int, height: int) -> str:
        result = self.search(text)
        image = result + '.svg'
        svg_path = os.path.join(logo_path, image)
        output_file = os.path.join(output_path, image)
        svg_to_png(svg_path, output_file, width, height)
        return output_file

if __name__ == '__main__':
    flag_icons = FlagIcons()
    test_texts = [
        "American",
        "China",
        "United Kingdom",
        "Deutschland",
        "American Samoa",
    ]
    for text in test_texts:
        result = flag_icons.search(text)
        print(result)
    flag_icons.search_and_save('China', 'test.png', 600, 600)

    logo_icons = logo_icons()
    test_texts = [
        "apple",
        "google",
        "facebook",
        "microsoft",
        "amazon",
    ]
    for text in test_texts:
        result = logo_icons.search_and_save(text, 'test_{}.png'.format(text), 600, 600)