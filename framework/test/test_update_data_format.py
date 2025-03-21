#!/usr/bin/env python3
import unittest
import json
import os
import tempfile
import shutil
from update_data_format import update_data_format, STANDARD_ADDITIONS

class TestDataFormatUpdater(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for test files
        self.test_dir = tempfile.mkdtemp()
        
        # Sample data in the old format
        self.old_format_data = {
            "metadata": {
                "title": "Test Chart",
                "description": "A test chart for unit testing"
            },
            "data": {
                "columns": [
                    {
                        "name": "Category",
                        "importance": "primary",
                        "description": "Chart categories",
                        "unit": "none",
                        "data_type": "categorical",
                        "role": "x"
                    },
                    {
                        "name": "Value",
                        "importance": "primary",
                        "description": "Chart values",
                        "unit": "none",
                        "data_type": "numerical",
                        "role": "y"
                    }
                ],
                "data": [
                    {
                        "Category": "A",
                        "Value": 10
                    },
                    {
                        "Category": "B",
                        "Value": 20
                    }
                ]
            }
        }
        
        # Expected output in the new format
        self.expected_output = {
            "metadata": {
                "title": "Test Chart",
                "description": "A test chart for unit testing"
            },
            "data_columns": [
                {
                    "name": "Category",
                    "importance": "primary",
                    "description": "Chart categories",
                    "unit": "none",
                    "data_type": "categorical",
                    "role": "x"
                },
                {
                    "name": "Value",
                    "importance": "primary",
                    "description": "Chart values",
                    "unit": "none",
                    "data_type": "numerical",
                    "role": "y"
                }
            ],
            "data": [
                {
                    "Category": "A",
                    "Value": 10
                },
                {
                    "Category": "B",
                    "Value": 20
                }
            ],
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
        
        # Create test file in old format
        self.test_file_path = os.path.join(self.test_dir, "test_data.json")
        with open(self.test_file_path, 'w', encoding='utf-8') as f:
            json.dump(self.old_format_data, f, indent=2)
    
    def tearDown(self):
        # Remove temporary directory and test files
        shutil.rmtree(self.test_dir)
    
    def test_update_data_format(self):
        """Test that the update_data_format function correctly transforms the data structure"""
        # Update the data format
        updated_data = update_data_format(self.old_format_data)
        
        # Check that the updated data matches the expected output
        self.assertEqual(updated_data["data"], self.expected_output["data"])
        self.assertEqual(updated_data["data_columns"], self.expected_output["data_columns"])
        
        # Check that all standard additions were added
        for key, value in STANDARD_ADDITIONS.items():
            self.assertIn(key, updated_data)
            self.assertEqual(updated_data[key], value)
    
    def test_data_preservation(self):
        """Test that no data is lost during the transformation"""
        updated_data = update_data_format(self.old_format_data)
        
        # Check that all original data points are preserved
        for i, item in enumerate(self.old_format_data["data"]["data"]):
            self.assertEqual(updated_data["data"][i], item)
        
        # Check that all column definitions are preserved
        for i, col in enumerate(self.old_format_data["data"]["columns"]):
            self.assertEqual(updated_data["data_columns"][i], col)
        
        # Check that metadata is preserved
        self.assertEqual(updated_data["metadata"], self.old_format_data["metadata"])

    def test_already_updated_data(self):
        """Test that already updated data is not modified"""
        # First update the data
        once_updated = update_data_format(self.old_format_data)
        
        # Update it again
        twice_updated = update_data_format(once_updated)
        
        # They should be identical
        self.assertEqual(once_updated, twice_updated)

if __name__ == "__main__":
    unittest.main() 