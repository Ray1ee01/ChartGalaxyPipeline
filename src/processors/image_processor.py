class ImageProcessor:
    def __init__(self):
        pass

    def url_to_base64(self, url: str) -> str:
        pass
    
    def get_width_and_height(self, url: str) -> Tuple[int, int]:
        pass
    
    def resize(self, base64_str: str, width: int, height: int) -> str:
        pass
    
    def crop(self, base64_str: str, x: int, y: int, width: int, height: int) -> str:
        pass
    
    def rotate(self, base64_str: str, degree: int) -> str:
        pass
    
    def flip(self, base64_str: str, direction: str) -> str:
        pass
    
    # def crop_with_container(self, base64_str: str, container_base64_str: str) -> str: