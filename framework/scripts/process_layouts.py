import os
import json
import shutil
from pathlib import Path

def process_layouts(input_dir: str, output_dir: str):
    """
    Process SVG and JSON files based on their layout information.
    
    Args:
        input_dir: Directory containing input SVG and JSON files
        output_dir: Base directory for output files
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get all JSON files
    json_files = list(Path(input_dir).glob("*.json"))
    
    for json_file in json_files:
        # Get corresponding SVG file
        svg_file = json_file.with_suffix('.svg')
        if not svg_file.exists():
            print(f"Warning: No corresponding SVG file found for {json_file}")
            continue
            
        try:
            # Read JSON file
            with open(json_file, 'r', encoding='utf-8') as f:
                layout_info = json.load(f)
                
            # Get layout information
            title_to_chart = layout_info.get('title_to_chart', 'unknown')
            image_to_chart = layout_info.get('image_to_chart', 'unknown')
            
            # Create layout directory name
            layout_dir = f"{title_to_chart}_{image_to_chart}"
            
            # Create output directory for this layout
            output_layout_dir = os.path.join(output_dir, layout_dir)
            os.makedirs(output_layout_dir, exist_ok=True)
            
            # Copy SVG file to new location
            output_svg_path = os.path.join(output_layout_dir, svg_file.name)
            shutil.copy2(svg_file, output_svg_path)
            
            print(f"Processed {svg_file.name} -> {layout_dir}/{svg_file.name}")
            
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Process SVG files based on layout information")
    parser.add_argument("--input", type=str, required=True, help="Input directory containing SVG and JSON files")
    parser.add_argument("--output", type=str, required=True, help="Output base directory")
    
    args = parser.parse_args()
    process_layouts(args.input, args.output) 