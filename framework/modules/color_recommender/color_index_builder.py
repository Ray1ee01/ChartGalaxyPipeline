import json
import numpy as np
import faiss
from typing import Dict, List, Optional
import os
from utils.model_loader import ModelLoader

class ColorIndexBuilder:
    def __init__(self, data_path: str = "./static/color_palette.json", index_path: str = "./static/color_palette.index", embed_model_path: str = "all-MiniLM-L6-v2"):
        # Convert relative path to absolute path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.color_palette_path = data_path
        # Use the global ModelLoader to get the model instance
        self.model = ModelLoader.get_model(embed_model_path)
        self.index = None
        self.color_palettes = None
        self.index_path = index_path
        self.dimension = 384  # Dimension of the sentence transformer embeddings

    def load_color_palettes(self) -> Dict[str, Dict]:
        """Load color palettes from the JSON file."""
        with open(self.color_palette_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def create_text_for_embedding(self, palette: Dict) -> str:
        """Create a text string from palette metadata for embedding."""
        text_parts = []
        
        # Add text if available
        if 'text' in palette:
            text_parts.append(palette['text'])
            
        # Add facts if available
        if 'facts' in palette:
            facts = palette['facts']
            if isinstance(facts, list):
                text_parts.extend(facts)
            elif isinstance(facts, str):
                text_parts.append(facts)
                
        # Add columns if available
        if 'columns' in palette:
            columns = palette['columns']
            if isinstance(columns, list):
                text_parts.extend(columns)
            elif isinstance(columns, str):
                text_parts.append(columns)
                
        return ' '.join(text_parts)

    def build_index(self):
        """Build the FAISS index for color palettes."""
        # Load color palettes
        self.color_palettes = self.load_color_palettes()
        
        # Create embeddings for each palette
        embeddings = []
        self.palette_indices = []
        
        for index, palette in self.color_palettes.items():
            text = self.create_text_for_embedding(palette)
            print('text', text)
            embedding = self.model.encode(text)
            embeddings.append(embedding)
            self.palette_indices.append(index)
            
        # Convert to numpy array
        embeddings = np.array(embeddings).astype('float32')
        
        # Create and train the index
        self.index = faiss.IndexFlatL2(self.dimension)
        self.index.add(embeddings)

    def find_similar_palettes(self, query_text: str, k: int = 5) -> List[Dict]:
        """
        Find similar color palettes based on text query.
        
        Args:
            query_text: Text to search for similar palettes
            k: Number of similar palettes to return
            
        Returns:
            List of similar color palettes with their distances
        """
        if self.index is None:
            self.build_index()
            
        # Create embedding for query
        query_embedding = self.model.encode(query_text)
        query_embedding = np.array([query_embedding]).astype('float32')
        
        # Search the index
        distances, indices = self.index.search(query_embedding, k)
        
        # Return similar palettes with their distances
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.palette_indices):  # Ensure index is valid
                palette_index = self.palette_indices[idx]
                results.append({
                    'palette': self.color_palettes[palette_index],
                    'distance': float(distances[0][i])
                })
                
        return results

    def save_index(self, output_path: str):
        """Save the FAISS index to disk."""
        if self.index is None:
            raise ValueError("Index has not been built yet")
        # Convert relative path to absolute path
        #current_dir = os.path.dirname(os.path.abspath(__file__))
        abs_output_path = output_path
        faiss.write_index(self.index, abs_output_path)
        
        # Save palette indices mapping
        indices_path = output_path + ".indices"
        with open(indices_path, 'w', encoding='utf-8') as f:
            json.dump(self.palette_indices, f)

    def load_index(self):
        """Load a FAISS index from disk."""
        # Convert relative path to absolute path
        # current_dir = os.path.dirname(os.path.abspath(__file__))
        index_path = self.index_path
        self.index = faiss.read_index(index_path)
        
        # Load color palettes
        self.color_palettes = self.load_color_palettes()
        
        # Load palette indices mapping
        indices_path = index_path + ".indices"
        if os.path.exists(indices_path):
            with open(indices_path, 'r', encoding='utf-8') as f:
                self.palette_indices = json.load(f)
        else:
            # For backward compatibility, create indices from keys
            self.palette_indices = list(self.color_palettes.keys())