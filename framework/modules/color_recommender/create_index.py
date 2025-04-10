#!/usr/bin/env python3
import argparse
import os
from modules.color_recommender.color_index_builder import ColorIndexBuilder

def main(force: bool=False):
    parser = argparse.ArgumentParser(description='Build color palette index using FAISS and SentenceTransformer')
    parser.add_argument('--input', '-i', type=str, default='./static/color_palette.json',
                        help='Path to input color palette JSON file')
    parser.add_argument('--output', '-o', type=str, default='./static/color_palette.index',
                        help='Path to save the FAISS index')
    parser.add_argument('--force', '-f', action='store_true',
                        help='Force rebuild even if index exists')
    parser.add_argument('--embed_model_path', type=str, default='', help='Path to sentence embedding model (optional)')

    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist")
        return 1
    
    # Check if output file exists and handle force flag
    if os.path.exists(args.output) and not (force or args.force):
        print(f"Index file {args.output} already exists. Use --force to rebuild.")
        return 0
    
    try:
        # Initialize and build index
        print("Initializing ColorIndexBuilder...")
        index_builder = ColorIndexBuilder(args.input, args.embed_model_path)
        
        print("Building index...")
        index_builder.build_index()
        
        print(f"Saving index to {args.output}...")
        index_builder.save_index(args.output)
        
        print("Index built successfully!")
        return 0
        
    except Exception as e:
        print(f"Error building index: {str(e)}")
        return 1

if __name__ == '__main__':
    exit(main()) 