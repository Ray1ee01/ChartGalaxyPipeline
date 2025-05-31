from sentence_transformers import SentenceTransformer
from typing import Optional

class ModelLoader:
    _instance = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelLoader, cls).__new__(cls)
        return cls._instance
    
    @classmethod
    def get_model(cls, model_path: Optional[str] = None) -> SentenceTransformer:
        """
        Get the SentenceTransformer model instance. If it hasn't been loaded yet,
        load it with the provided model path.
        
        Args:
            model_path: Path to the model. If None, use default model.
            
        Returns:
            SentenceTransformer instance
        """
        if cls._model is None:
            if model_path:
                cls._model = SentenceTransformer(model_path)
            else:
                cls._model = SentenceTransformer("all-MiniLM-L6-v2")
        return cls._model 