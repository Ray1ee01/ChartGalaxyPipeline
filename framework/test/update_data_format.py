#!/usr/bin/env python3
import json
import os
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("DataFormatUpdater")

# Standard attributes to add to all files
STANDARD_ADDITIONS = {
    "secondary_data": [],
    "variables": {
      "width": 600,
      "height": 600,
      "has_rounded_corners": False,
      "has_shadow": False,
      "has_spacing": False,
      "has_gradient": False,
      "has_stroke": False
    },
    "typography": {
      "title": {
        "font_family": "Arial",
        "font_size": "28px",
        "font_weight": 700
      },
      "description": {
        "font_family": "Arial",
        "font_size": "16px",
        "font_weight": 500
      },
      "label": {
        "font_family": "Arial",
        "font_size": "16px",
        "font_weight": 500
      },
      "annotation": {
        "font_family": "Arial",
        "font_size": "12px",
        "font_weight": 400
      }
    }
}

def update_data_format(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update the data format to match the new requirements:
    1. Change data: {columns, data} to data, data_columns
    2. Add standard attributes from STANDARD_ADDITIONS
    
    Args:
        data: The original data JSON object
        
    Returns:
        Updated data JSON object
    """
    updated_data = data.copy()
    
    # Check if the old data format exists
    if "data" in updated_data and isinstance(updated_data["data"], dict):
        if "columns" in updated_data["data"] and "data" in updated_data["data"]:
            # Extract columns and data from the nested structure
            columns = updated_data["data"]["columns"]
            data_points = updated_data["data"]["data"]
            
            # Remove the old structure
            del updated_data["data"]
            
            # Add the new structure
            updated_data["data"] = data_points
            updated_data["data_columns"] = columns
            
            logger.info("Transformed data structure from nested to flat format")
    
    # Add standard attributes
    for key, value in STANDARD_ADDITIONS.items():
        if key not in updated_data:
            updated_data[key] = value
            logger.info(f"Added missing standard attribute: {key}")
    
    return updated_data

def process_file(input_path: str, output_path: str = None) -> None:
    """
    Process a single file to update its data format
    
    Args:
        input_path: Path to the input JSON file
        output_path: Optional path to save the output (defaults to overwrite input)
    """
    if output_path is None:
        output_path = input_path
    
    # Load input data
    logger.info(f"Loading data from {input_path}")
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"Error loading {input_path}: {str(e)}")
        return
    
    # Update data format
    updated_data = update_data_format(data)
    
    # Save updated data
    logger.info(f"Saving updated data to {output_path}")
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving to {output_path}: {str(e)}")

def process_directory(directory_path: str) -> None:
    """
    Process all JSON files in a directory to update their data format
    
    Args:
        directory_path: Path to the directory containing JSON files
    """
    # Check if directory exists
    if not os.path.exists(directory_path):
        logger.error(f"Directory not found: {directory_path}")
        return
    
    # Get all JSON files in the directory
    json_files = [f for f in os.listdir(directory_path) if f.endswith('.json')]
    
    if not json_files:
        logger.warning(f"No JSON files found in {directory_path}")
        return
    
    logger.info(f"Found {len(json_files)} JSON files to process")
    
    # Process each file
    for filename in json_files:
        input_path = os.path.join(directory_path, filename)
        process_file(input_path)

def main():
    """
    Main function to run the data format updater
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Update data format in JSON files")
    parser.add_argument("--input", help="Input JSON file or directory")
    parser.add_argument("--output", help="Output JSON file (only when input is a file)")
    
    args = parser.parse_args()
    
    try:
        if not args.input:
            logger.error("No input specified")
            return 1
        
        input_path = args.input
        
        if os.path.isdir(input_path):
            if args.output:
                logger.warning("Output path ignored when input is a directory")
            
            process_directory(input_path)
        elif os.path.isfile(input_path):
            process_file(input_path, args.output)
        else:
            logger.error(f"Input path does not exist: {input_path}")
            return 1
        
        logger.info("Processing completed successfully")
        return 0
    
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 