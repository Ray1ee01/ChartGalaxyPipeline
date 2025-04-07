import os
import json
import sys
from collections import Counter
from typing import Dict, List, Set, Tuple

# Add parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import data_resource_path

def analyze_data_type_combinations(directory: str, subdir: str = None) -> Tuple[Dict[str, int], Dict[str, List[Dict[str, List[str]]]]]:
    """
    Analyze the data type combinations in JSON files in the specified directory.
    
    Args:
        directory: Base directory path
        subdir: Optional subdirectory to scan (relative to base directory)
        
    Returns:
        Tuple containing:
        - Dictionary with data type combinations as keys and counts as values
        - Dictionary with data type combinations as keys and list of file details as values
    """
    # Dictionary to store data type combinations and their counts
    data_type_combinations = Counter()
    
    # Dictionary to store file details for each combination
    combination_details = {}
    
    # Construct the full path to scan
    scan_path = os.path.join(directory, subdir) if subdir else directory
    
    # Get all JSON files recursively
    json_files = []
    for root, _, files in os.walk(scan_path):
        for file in files:
            if file.endswith('.json'):
                json_files.append(os.path.join(root, file))
    
    print(f"Found {len(json_files)} JSON files to analyze")
    
    # Process each JSON file
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check if the file has the expected structure
            if 'data' not in data or 'columns' not in data['data']:
                print(f"File {file_path} does not have the expected structure")
                continue
            
            # Get all data types from the columns
            data_types = []
            column_details = {}
            
            for column in data['data']['columns']:
                if 'data_type' in column:
                    data_type = column['data_type']
                    data_types.append(data_type)
                    
                    # Group column names by data type
                    if data_type not in column_details:
                        column_details[data_type] = []
                    column_details[data_type].append(column['name'])
            
            # Create a combination key
            combination = " + ".join(data_types)
            
            # Increment the count for this combination
            data_type_combinations[combination] += 1
            
            # Store file details
            if combination not in combination_details:
                combination_details[combination] = []
            
            # Store relative path for display
            relative_path = os.path.relpath(file_path, directory)
            combination_details[combination].append({
                'filename': relative_path,
                'columns': column_details
            })
            
            # Write the type_combination back to the data
            data['data']['type_combination'] = combination
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
    
    return data_type_combinations, combination_details

def main():
    """
    Main function to analyze data type combinations in JSON files
    """
    # Use data_resource_path from config
    input_dir = data_resource_path
    
    # You can specify a subdirectory here, or leave it as None to scan all
    subdir = None  # Example: "specific_folder"
    
    # Analyze data type combinations
    combinations, details = analyze_data_type_combinations(input_dir, subdir)
    
    # Print results
    print("\nData Type Combinations Analysis:")
    print("=================================")
    
    # Sort by count in descending order
    sorted_combinations = sorted(combinations.items(), key=lambda x: x[1], reverse=True)
    
    for combination, count in sorted_combinations:
        print(f"{combination}: {count} files")
        
        # For combinations with fewer than 10 files, print detailed information
        if count < 15:
            print("  Detailed information:")
            for file_info in details[combination]:
                # Remove the file using os.remove
                full_path = os.path.join(input_dir, file_info['filename'])
                os.remove(full_path)
                print(f"  - Filename: {file_info['filename']}")
                print("    Columns by data type:")
                for data_type, column_names in file_info['columns'].items():
                    print(f"      {data_type}: {', '.join(column_names)}")
            print()
    
    # Print total
    total_files = sum(combinations.values())
    print(f"\nTotal files analyzed: {total_files}")

if __name__ == "__main__":
    main() 
