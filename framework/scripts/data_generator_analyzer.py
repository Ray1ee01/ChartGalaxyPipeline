import json
import os
from pathlib import Path
from typing import Dict, List, Any

def aggregate_json_data(data_dir: str) -> Dict[str, Any]:
    """
    Aggregate data from all JSON files in the specified directory.
    
    Args:
        data_dir: Path to the directory containing JSON files
        
    Returns:
        Dictionary containing aggregated data with the following structure:
        {
            "titles": {
                "main_titles": List[str],
                "sub_titles": List[str]
            },
            "columns": List[Dict[str, str]]  # List of column information
        }
    """
    aggregated_data = {
        "titles": {
            "main_titles": [],
            "sub_titles": []
        },
        "columns": []
    }
    
    # Walk through the directory
    for root, _, files in os.walk(data_dir):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        
                        # Extract titles
                        if 'titles' in data:
                            if 'main_title' in data['titles']:
                                aggregated_data['titles']['main_titles'].append(data['titles']['main_title'])
                            if 'sub_title' in data['titles']:
                                aggregated_data['titles']['sub_titles'].append(data['titles']['sub_title'])
                        
                        # Extract columns
                        if 'data' in data and 'columns' in data['data']:
                            for column in data['data']['columns']:
                                if isinstance(column, dict):
                                    aggregated_data['columns'].append({
                                        'name': column.get('name', ''),
                                        'description': column.get('description', ''),
                                        'data_type': column.get('data_type', '')
                                    })
                except json.JSONDecodeError:
                    print(f"Error decoding JSON in file: {file_path}")
                except Exception as e:
                    print(f"Error processing file {file_path}: {str(e)}")
    
    return aggregated_data

def main():
    # Update this path to the correct location of your JSON files
    data_dir = "/data/lizhen/resources/data/original_data"
    
    # Check if directory exists
    if not os.path.exists(data_dir):
        print(f"Error: Directory {data_dir} does not exist")
        return
    
    # Aggregate the data
    aggregated_data = aggregate_json_data(data_dir)
    
    # Save the aggregated data
    output_file = "aggregated_data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(aggregated_data, f, indent=2, ensure_ascii=False)
    
    print(f"Aggregated data has been saved to {output_file}")
    print(f"Found {len(aggregated_data['titles']['main_titles'])} main titles")
    print(f"Found {len(aggregated_data['titles']['sub_titles'])} sub titles")
    print(f"Found {len(aggregated_data['columns'])} columns")

if __name__ == "__main__":
    main()
