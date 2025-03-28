import argparse
from .title_generator import RagTitleGenerator

def process(data,
            index_path: str='faiss_infographics.index',
            data_path: str='infographics_data.npy',
            embed_model_path: str=''):
    try:
        print("Initializing RagTitleGenerator...")
        generator = RagTitleGenerator(
            index_path=index_path,
            data_path=data_path,
            embed_model_path=embed_model_path
        )

        print("Building FAISS index...")
        generator.build_faiss_index(data)
        print("Index built and saved successfully.")
    except Exception as e:
        return False
    
    return True

def main():
    parser = argparse.ArgumentParser(description="Build FAISS index for title generation")
    parser.add_argument('--data', type=str, required=True, help='Path to training data JSON file')
    parser.add_argument('--index_path', type=str, default='faiss_infographics.index', help='Path to store FAISS index')
    parser.add_argument('--data_path', type=str, default='infographics_data.npy', help='Path to store embedding + title data')
    parser.add_argument('--embed_model_path', type=str, default='', help='Path to sentence embedding model (optional)')

    args = parser.parse_args()

    process(args.data, args.index_path, args.data_path, args.embed_model_path)

if __name__ == "__main__":
    main()
