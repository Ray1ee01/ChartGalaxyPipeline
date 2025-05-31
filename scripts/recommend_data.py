import os
import json
import sys
import random
import argparse
from collections import Counter
from typing import Dict, List, Set, Tuple, Any

# Add parent directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import result_resource_path

def analyze_value_ranges(data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Analyze value ranges for different data types in the dataset.
    
    Args:
        data: The JSON data to analyze
        
    Returns:
        Dictionary containing value range information for each column
    """
    value_ranges = {}
    
    if 'data' not in data or 'data' not in data['data'] or 'columns' not in data['data']:
        return value_ranges
        
    # Get column information
    columns = {col['name']: col for col in data['data']['columns']}
    
    # Initialize value ranges for each column
    for col_name, col_info in columns.items():
        if 'data_type' not in col_info:
            continue
            
        data_type = col_info['data_type']
        value_ranges[col_name] = {'data_type': data_type}
        
        # Extract values for this column
        values = [row[col_name] for row in data['data']['data'] if col_name in row]
        
        if data_type == 'numerical':
            # For numerical data, try to convert to float, but only if possible
            numeric_values = []
            for val in values:
                if val is None:
                    continue
                try:
                    numeric_values.append(float(val))
                except (ValueError, TypeError):
                    # If conversion fails, skip this value
                    continue
            if numeric_values:
                value_ranges[col_name]['min'] = min(numeric_values)
                value_ranges[col_name]['max'] = max(numeric_values)
        elif data_type == 'temporal':
            # For temporal data, just count unique values and store them
            # Convert all values to string for consistent comparison
            unique_values = set(str(val) for val in values if val is not None)
            value_ranges[col_name]['unique_count'] = len(unique_values)
            value_ranges[col_name]['unique_values'] = sorted(list(unique_values))
        elif data_type == 'categorical':
            # For categorical data, count unique values and store them
            unique_values = set(str(val) for val in values if val is not None)
            value_ranges[col_name]['unique_count'] = len(unique_values)
            value_ranges[col_name]['unique_values'] = list(unique_values)
            
    return value_ranges

def analyze_data_type_combinations(directory: str, subdir: str = None) -> Tuple[Dict[str, int], Dict[str, List[Dict[str, Any]]]]:
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
            
            # Analyze value ranges
            value_ranges = analyze_value_ranges(data)
            
            combination_details[combination].append({
                'filename': relative_path,
                'columns': column_details,
                'value_ranges': value_ranges
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
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Analyze data type combinations in JSON files')
    parser.add_argument('--type', type=str, help='Filter by type combination abbreviation (e.g., "nc" for numerical+categorical)')
    args = parser.parse_args()
    
    # Use result_resource_path from config
    input_dir = result_resource_path
    
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
        # Convert combination to abbreviated format (e.g., "numerical + categorical" -> "nc")
        abbr_combination = ''.join([data_type[0].lower() for data_type in combination.split(' + ')])
        
        # Skip if a type filter is specified and doesn't match
        if args.type and args.type.lower() != abbr_combination:
            continue
            
        print(f"\n{combination}: {count} files")
        print(f"Abbreviated as: {abbr_combination}")
        print("-" * 40)  # Add a separator line between different types
        
        # Randomly sample 10 files for each combination
        sample_files = random.sample(details[combination], min(10, len(details[combination])))
        
        for file_info in sample_files:
            print(f"\n  File: {file_info['filename']}")
            print("  Value Ranges:")
            for col_name, col_info in file_info['value_ranges'].items():
                data_type = col_info['data_type']
                if data_type == 'numerical':
                    print(f"    {col_name} ({data_type}):")
                    print(f"      Range: [{col_info.get('min', 'N/A')}, {col_info.get('max', 'N/A')}]")
                elif data_type in ['temporal', 'categorical']:
                    print(f"    {col_name} ({data_type}):")
                    print(f"      Unique values count: {col_info.get('unique_count', 'N/A')}")
                    if 'unique_values' in col_info and len(col_info['unique_values']) <= 10:
                        print(f"      Values: {', '.join(str(v) for v in col_info['unique_values'])}")
                    elif 'unique_values' in col_info:
                        print(f"      First 10 values: {', '.join(str(v) for v in list(col_info['unique_values'])[:10])}")
        
        # Add another separator after each combination's details
        print("-" * 40)
    
    # Print total
    if args.type:
        filtered_count = sum(count for comb, count in combinations.items() 
                           if ''.join([dt[0].lower() for dt in comb.split(' + ')]) == args.type.lower())
        print(f"\nTotal files for type '{args.type}': {filtered_count}")
    else:
        total_files = sum(combinations.values())
        print(f"\nTotal files analyzed: {total_files}")

if __name__ == "__main__":
    main() 
