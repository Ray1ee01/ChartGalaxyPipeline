#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
ChartPipeline: Simplified implementation of modules 1-6
This script implements a simplified version of the first 6 modules in the ChartPipeline framework.
"""

import json
import random
import argparse
import logging
import re
import copy
import sys
import requests
from pathlib import Path
from typing import Dict, List, Any, Union, Optional
import base64
import os
from collections import Counter
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ChartPipeline-Simplified")

# Initialize BERT model and tokenizer for embeddings
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
    model = AutoModel.from_pretrained("bert-base-uncased")
    logger.info("Successfully loaded BERT model for embeddings")
    USE_BERT = True
except Exception as e:
    logger.warning(f"Failed to load BERT model: {str(e)}. Will use simplified embeddings instead.")
    USE_BERT = False
    # Make dummy imports to avoid errors
    class DummyModule:
        pass
    if 'torch' not in sys.modules:
        sys.modules['torch'] = DummyModule()
    if 'transformers' not in sys.modules:
        transformers_dummy = DummyModule()
        transformers_dummy.AutoTokenizer = DummyModule
        transformers_dummy.AutoModel = DummyModule
        sys.modules['transformers'] = transformers_dummy

# Cache for icon embeddings to avoid recomputing
ICON_EMBEDDINGS_CACHE = {}

# OpenAI API configuration
API_KEY = 'sk-GZPrsS9VcR4Xf5iADf6a55D0C0Bb4f8d8f12DaC9F0857cAe'
API_PROVIDER = 'https://aihubmix.com'

def query_openai(prompt: str) -> str:
    """
    Query OpenAI API with a prompt
    Args:
        prompt: The prompt to send to OpenAI
    Returns:
        str: The response from OpenAI
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gemini-2.0-flash',
        'messages': [
            {'role': 'system', 'content': 'You are a data visualization expert. Provide concise, specific answers.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.3,  # Lower temperature for more focused responses
        'max_tokens': 3000    # Limit response length
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"Error querying OpenAI: {e}")
        return None

# Color palette
COLOR_PALETTE = ["#4269d0", "#efb118", "#ff725c", "#6cc5b0", "#3ca951", "#ff8ab7", "#a463f2", "#97bbf5"]

# Layout options
LAYOUT_OPTIONS = [
    {
        "title_to_chart": "TL",
        "image_to_chart": "R",
        "title_to_image": "TL",
        "chart_contains_title": False,
        "chart_contains_image": True
    },
    {
        "title_to_chart": "TL",
        "image_to_chart": "TR",
        "title_to_image": "L",
        "chart_contains_title": False,
        "chart_contains_image": False
    },
    {
        "title_to_chart": "TL",
        "image_to_chart": "L",
        "title_to_image": "T",
        "chart_contains_title": True,
        "chart_contains_image": True
    }
]

def parse_datafact_prompt(prompt: str, data_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Prepare data for sending to a language model with the datafact_prompt.
    Uses the OpenAI API to generate data facts.
    
    Args:
        prompt: The datafact prompt template
        data_json: The input data JSON object
        
    Returns:
        List of data facts
    """
    logger.info("Preparing data for datafact generation")
    
    # Extract data for formatting
    metadata = data_json.get("metadata", {})
    columns = data_json.get("data", {}).get("columns", [])
    data_points = data_json.get("data", {}).get("data", [])
    
    if not columns or not data_points:
        logger.warning("No data columns or points found to generate data facts")
        return []
    
    # Format the data description for the prompt
    data_description = []
    
    # Add title and description if available
    if "title" in metadata:
        data_description.append(f"Title: {metadata['title']}")
    if "description" in metadata:
        data_description.append(f"Description: {metadata['description']}")
    
    # Add column information
    data_description.append("\nColumns:")
    for col in columns:
        col_info = []
        if "name" in col:
            col_info.append(f"Name: {col['name']}")
        if "description" in col:
            col_info.append(f"Description: {col['description']}")
        if "data_type" in col:
            col_info.append(f"Type: {col['data_type']}")
        if "role" in col:
            col_info.append(f"Role: {col['role']}")
        if "unit" in col and col["unit"] != "none":
            col_info.append(f"Unit: {col['unit']}")
        
        data_description.append(" | ".join(col_info))
    
    # Add sample data points (limited to first 10 for clarity)
    data_description.append("\nData:")
    max_samples = min(10, len(data_points))
    for i in range(max_samples):
        item = data_points[i]
        item_str = ", ".join([f"{k}: {v}" for k, v in item.items()])
        data_description.append(f"Row {i+1}: {item_str}")
    
    if len(data_points) > max_samples:
        data_description.append(f"...and {len(data_points) - max_samples} more rows")
    
    # Format the complete prompt with data
    formatted_data = "\n".join(data_description)
    final_prompt = prompt.replace("INPUT_TEXT", formatted_data)
    
    logger.info("Data formatted for datafact generation")
    
    # Call the OpenAI API to generate data facts
    try:
        logger.info("Calling language model API to generate data facts")
        response = query_openai(final_prompt)
        
        if not response:
            logger.warning("Failed to get response from language model API, falling back to simplified logic")
            return generate_fallback_datafacts(data_json)
        
        # Parse the JSON response
        try:
            # The model might wrap the JSON with markdown code blocks, remove them if present
            if response.startswith("```json"):
                response = response[7:]
            if response.endswith("```"):
                response = response[:-3]
            
            # Strip any leading/trailing whitespace
            response = response.strip()
            
            # Parse the JSON
            data_facts = json.loads(response)
            logger.info(f"Successfully parsed {len(data_facts)} data facts from API response")
            return data_facts
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse data facts response as JSON: {e}")
            logger.warning(f"Raw response: {response}")
            return generate_fallback_datafacts(data_json)
    except Exception as e:
        logger.warning(f"Error calling language model API: {e}")
        return generate_fallback_datafacts(data_json)

def generate_fallback_datafacts(data_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Generate fallback data facts when the API call fails
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        List of data facts
    """
    logger.info("Using fallback logic to generate data facts")
    
    # Extract data for analysis
    columns = data_json.get("data", {}).get("columns", [])
    data_points = data_json.get("data", {}).get("data", [])
    
    # Find x and y columns
    x_column = next((col.get("name") for col in columns if col.get("role") == "x"), None)
    y_column = next((col.get("name") for col in columns if col.get("role") == "y"), None)
    
    if not x_column or not y_column:
        return []
    
    # Generate insights based on the data
    if any(col.get("data_type") == "numerical" for col in columns):
        sorted_data = sorted(data_points, key=lambda x: x.get(y_column, 0), reverse=True)
        
        # Find max and min values
        max_value = sorted_data[0]
        min_value = sorted_data[-1]
        
        # Calculate average
        total = sum(item.get(y_column, 0) for item in data_points)
        avg_value = total / len(data_points) if data_points else 0
        
        # Generate data facts
        data_facts = [
            {
                "type": "value",
                "score": 0.95,
                "annotation": f"{max_value.get(x_column)} has highest {y_column}",
                "reason": f"{max_value.get(x_column)} has the highest {y_column} at {max_value.get(y_column)}"
            },
            {
                "type": "value",
                "score": 0.85,
                "annotation": f"{min_value.get(x_column)} has lowest {y_column}",
                "reason": f"{min_value.get(x_column)} has the lowest {y_column} at {min_value.get(y_column)}"
            },
            {
                "type": "difference",
                "score": 0.80,
                "annotation": f"Gap between highest and lowest is {max_value.get(y_column) - min_value.get(y_column)}",
                "reason": f"The difference between the highest value ({max_value.get(y_column)}) and lowest value ({min_value.get(y_column)}) is {max_value.get(y_column) - min_value.get(y_column)}"
            },
            {
                "type": "overview",
                "score": 0.75,
                "annotation": f"Average {y_column} is {avg_value:.1f}",
                "reason": f"The average {y_column} across all {x_column} values is {avg_value:.1f}"
            }
        ]
        
        # If more than 3 data points, add trend insight
        if len(data_points) > 3:
            data_facts.append({
                "type": "trend",
                "score": 0.70,
                "annotation": f"{y_column} varies significantly across {x_column}",
                "reason": f"The {y_column} shows considerable variation across different {x_column} values, with a range of {max_value.get(y_column) - min_value.get(y_column)}"
            })
        
        # Add specific insights based on the data
        if len(data_points) > 2 and "Manchester" in max_value.get(x_column, "") and "Manchester" in sorted_data[1].get(x_column, ""):
            data_facts.append({
                "type": "comparison",
                "score": 0.65,
                "annotation": f"All Manchester terminals have long waiting times",
                "reason": f"Manchester airports occupy the top positions with waiting times of {', '.join([str(item.get(y_column)) for item in sorted_data[:3] if 'Manchester' in item.get(x_column, '')])}"
            })
        
        return data_facts
    
    return []

def module1_chart_type_recommender(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 1: Chart Type Recommender (simplified - returns empty)
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with chart_type recommendations
    """
    logger.info("Module 1: Chart Type Recommender (simplified)")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # In the simplified version, this module is left empty as requested
    result["chart_type"] = []
    
    return result

def module2_datafact_generator(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 2: Data Fact Generator
    Uses the datafact_prompt to generate insights about the data
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with datafacts
    """
    logger.info("Module 2: Data Fact Generator")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # Load the datafact prompt by importing it
    try:
        # Try to directly import the prompt from prompt.py
        from prompt import datafact_prompt
        logger.info("Successfully imported datafact_prompt from prompt.py")
    except ImportError as e:
        logger.warning(f"Failed to import datafact_prompt: {str(e)}")
        # Provide a minimal fallback prompt
        datafact_prompt = (
            "Analyze the following data and provide key insights.\n"
            "For each insight, include type, importance score, brief annotation, and detailed reason.\n"
            "Types can be: trend, proportion, outlier, difference, value, correlation, distribution, overview\n"
            "Respond in JSON format with an array of insight objects.\n"
            "INPUT_TEXT"
        )
    
    # Generate data facts
    data_facts = parse_datafact_prompt(datafact_prompt, data_json)
    
    # Add data facts to the result
    result["datafacts"] = data_facts
    logger.info(f"Generated {len(data_facts)} data facts")
    
    return result

def module3_title_generator(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 3: Title Generator
    Uses metadata title as main_title and description as sub_title
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with titles
    """
    logger.info("Module 3: Title Generator")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # Get metadata
    metadata = data_json.get("metadata", {})
    
    # Set titles from metadata
    result["titles"] = {
        "main_title": metadata.get("title", ""),
        "sub_title": metadata.get("description", "")
    }
    
    return result

def module4_layout_recommender(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 4: Layout Recommender
    Randomly selects from predefined layout options and extracts variation from _extra
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with layout and variation
    """
    logger.info("Module 4: Layout Recommender")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # Randomly select a layout from the predefined options
    layout = random.choice(LAYOUT_OPTIONS)
    
    # Extract variation from _extra if available
    variation = {}
    if "_extra" in data_json and "image_data" in data_json["_extra"] and "data" in data_json["_extra"]["image_data"]:
        extra_data = data_json["_extra"]["image_data"]["data"]
        
        variation = {
            "background": extra_data.get("background", "no"),
            "image_chart": extra_data.get("image_chart", "side"),
            "image_title": extra_data.get("image_title", "none"),
            "icon_mark": extra_data.get("icon_mark", "none"),
            "axis_label": extra_data.get("axis_label", "none"),
            "axes": {
                "x_axis": extra_data.get("axes", {}).get("x_axis", "yes"),
                "y_axis": extra_data.get("axes", {}).get("y_axis", "yes")
            }
        }
    else:
        # Default variation if not available in _extra
        variation = {
            "background": "no",
            "image_chart": "side",
            "image_title": "none",
            "icon_mark": "none",
            "axis_label": "none",
            "axes": {
                "x_axis": "yes",
                "y_axis": "yes"
            }
        }
    
    # Add layout and variation to the result
    result["layout"] = layout
    result["variation"] = variation
    
    return result

def module5_color_recommender(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 5: Color Recommender
    Assigns colors based on the specified rules:
    - If x+y, use a random color from palette as primary
    - If x+y+group, use group field for colors
    - Put remaining colors in available_colors
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with color recommendations
    """
    logger.info("Module 5: Color Recommender")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # Extract column information
    columns = data_json.get("data", {}).get("columns", [])
    data_points = data_json.get("data", {}).get("data", [])
    
    # Find columns with roles
    x_column = next((col.get("name") for col in columns if col.get("role") == "x"), None)
    y_column = next((col.get("name") for col in columns if col.get("role") == "y"), None)
    group_column = next((col.get("name") for col in columns if col.get("role") == "group"), None)
    
    # Initialize colors object
    colors = {
        "field": {},
        "other": {},
        "available_colors": [],
        "background_color": "#FFFFFF",
        "text_color": "#000000"
    }
    
    # Create a copy of the color palette to work with
    available_colors = COLOR_PALETTE.copy()
    
    # Case: x+y+group
    if x_column and y_column and group_column:
        # Get unique group values
        group_values = set()
        for item in data_points:
            if group_column in item:
                group_values.add(item[group_column])
        
        # Assign colors to group values
        for i, group_value in enumerate(group_values):
            color_index = i % len(available_colors)
            colors["field"][group_value] = available_colors[color_index]
            # Remove used color
            available_colors.pop(color_index)
    
    # Case: x+y
    elif x_column and y_column:
        # Select a random color for primary
        primary_color_index = random.randint(0, len(available_colors) - 1)
        colors["other"]["primary"] = available_colors[primary_color_index]
        # Remove used color
        available_colors.pop(primary_color_index)
        
        # If there are more colors available, select one for secondary
        if available_colors:
            secondary_color_index = random.randint(0, len(available_colors) - 1)
            colors["other"]["secondary"] = available_colors[secondary_color_index]
            # Remove used color
            available_colors.pop(secondary_color_index)
    
    # Add remaining colors to available_colors
    colors["available_colors"] = available_colors
    
    # Add colors to the result
    result["colors"] = colors
    
    return result

def image_to_base64(image_path):
    """
    Convert an image file to base64-encoded string
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Base64-encoded string
    """
    try:
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/png;base64,{encoded_string}"
    except Exception as e:
        logger.warning(f"Failed to convert image to base64: {str(e)}")
        return None

def get_simplified_embedding(text):
    """
    Create a simplified "embedding" using word frequencies
    This is a very basic approximation of semantic similarity
    
    Args:
        text: Input text
    
    Returns:
        Dictionary of word frequencies
    """
    # Convert to lowercase and split into words
    words = text.lower().replace('_', ' ').replace('-', ' ').split()
    # Count word frequencies
    return Counter(words)

def calculate_similarity(embedding1, embedding2):
    """
    Calculate similarity between two simplified embeddings
    
    Args:
        embedding1: First embedding (Counter)
        embedding2: Second embedding (Counter)
    
    Returns:
        Similarity score
    """
    # Get common words
    common_words = set(embedding1.keys()) & set(embedding2.keys())
    
    if not common_words:
        return 0
    
    # Calculate dot product of common words
    similarity = sum(embedding1[word] * embedding2[word] for word in common_words)
    
    # Normalize
    norm1 = sum(val ** 2 for val in embedding1.values()) ** 0.5
    norm2 = sum(val ** 2 for val in embedding2.values()) ** 0.5
    
    if norm1 == 0 or norm2 == 0:
        return 0
    
    return similarity / (norm1 * norm2)

def get_bert_embedding(text):
    """
    Get BERT embedding for a given text
    
    Args:
        text: Input text
        
    Returns:
        Numpy array of embedding
    """
    if not USE_BERT:
        return get_simplified_embedding(text)
    
    try:
        # Add special tokens and convert to tensor
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128)
        
        # Get model output (without gradient calculation for efficiency)
        with torch.no_grad():
            outputs = model(**inputs)
        
        # Use the [CLS] token embedding as the sentence embedding
        embedding = outputs.last_hidden_state[:, 0, :].numpy()
        return embedding[0]  # Return the first (and only) embedding
    except Exception as e:
        logger.warning(f"Error generating BERT embedding: {str(e)}. Using simplified embedding instead.")
        return get_simplified_embedding(text)

def precompute_icon_embeddings(icon_dir="test_data/icon"):
    """
    Precompute embeddings for all icons in the directory
    
    Args:
        icon_dir: Directory containing icons
        
    Returns:
        Dictionary mapping icon paths to their embeddings
    """
    global ICON_EMBEDDINGS_CACHE
    
    if not os.path.exists(icon_dir):
        logger.warning(f"Icon directory not found: {icon_dir}")
        return {}
    
    logger.info(f"Precomputing embeddings for icons in {icon_dir}")
    embeddings = {}
    
    for filename in os.listdir(icon_dir):
        if filename.lower().endswith('.png'):
            # Extract words from filename
            name_without_ext = os.path.splitext(filename)[0]
            # Get embedding
            if USE_BERT:
                embedding = get_bert_embedding(name_without_ext)
            else:
                embedding = get_simplified_embedding(name_without_ext)
            # Store in cache
            icon_path = os.path.join(icon_dir, filename)
            embeddings[icon_path] = embedding
    
    logger.info(f"Precomputed embeddings for {len(embeddings)} icons")
    ICON_EMBEDDINGS_CACHE = embeddings
    return embeddings

def calculate_bert_similarity(embedding1, embedding2):
    """
    Calculate cosine similarity between two BERT embeddings
    
    Args:
        embedding1: First embedding (numpy array)
        embedding2: Second embedding (numpy array)
        
    Returns:
        Similarity score
    """
    # If either embedding is a Counter (from simplified embedding), use the simplified similarity
    if isinstance(embedding1, Counter) or isinstance(embedding2, Counter):
        return calculate_similarity(embedding1, embedding2)
    
    # Calculate cosine similarity: dot(a, b) / (||a|| * ||b||)
    dot_product = np.dot(embedding1, embedding2)
    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)
    
    if norm1 == 0 or norm2 == 0:
        return 0
    
    return dot_product / (norm1 * norm2)

def find_best_matching_icon(text, icon_dir="test_data/icon"):
    """
    Find the best matching icon for a given text using BERT embeddings
    
    Args:
        text: Text to match
        icon_dir: Directory containing icons
        
    Returns:
        Path to the best matching icon
    """
    if not os.path.exists(icon_dir):
        logger.warning(f"Icon directory not found: {icon_dir}")
        return None
    
    # Get text embedding
    if USE_BERT:
        text_embedding = get_bert_embedding(text)
    else:
        text_embedding = get_simplified_embedding(text)
    
    # Ensure icon embeddings are precomputed
    global ICON_EMBEDDINGS_CACHE
    if not ICON_EMBEDDINGS_CACHE:
        precompute_icon_embeddings(icon_dir)
    
    best_match = None
    best_score = -1
    
    # Compare with all precomputed icon embeddings
    for icon_path, icon_embedding in ICON_EMBEDDINGS_CACHE.items():
        # Calculate similarity
        if USE_BERT:
            similarity = calculate_bert_similarity(text_embedding, icon_embedding)
        else:
            similarity = calculate_similarity(text_embedding, icon_embedding)
        
        if similarity > best_score:
            best_score = similarity
            best_match = icon_path
    
    # If no good match found, return a default icon
    if best_score < 0.2:  # Higher threshold for BERT embeddings
        # Return a random icon as fallback
        all_icons = list(ICON_EMBEDDINGS_CACHE.keys())
        if all_icons:
            return random.choice(all_icons)
    
    return best_match

def module6_image_recommender(data_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Module 6: Image Recommender
    Recommends images for only one attribute based on priority rules:
    - If x is temporal/numerical, assign images to group values
    - Otherwise, assign images to x values
    
    Args:
        data_json: The input data JSON object
        
    Returns:
        Updated JSON object with image recommendations
    """
    logger.info("Module 6: Image Recommender")
    
    # Create a deep copy of the input data
    result = copy.deepcopy(data_json)
    
    # Initialize images object
    images = {
        "field": {},
        "other": {}
    }
    
    # Check if icon directory exists
    icon_dir = "test_data/icon"
    if not os.path.exists(icon_dir):
        logger.warning(f"Icon directory not found: {icon_dir}. Cannot recommend images.")
        result["images"] = images
        return result
    
    # Extract column information and metadata
    columns = data_json.get("data", {}).get("columns", [])
    data_points = data_json.get("data", {}).get("data", [])
    metadata = data_json.get("metadata", {})
    
    # Ensure icon embeddings are precomputed for efficiency
    precompute_icon_embeddings(icon_dir)
    
    # Find x and group columns
    x_column = None
    x_is_temporal = False
    group_column = None
    
    for col in columns:
        if col.get("role") == "x":
            x_column = col.get("name")
            # Check if x is temporal
            if col.get("data_type") in ["temporal", "time", "date"]:
                x_is_temporal = True
        elif col.get("role") == "group":
            group_column = col.get("name")
    
    # Process field images based on priority rules
    if data_points:
        # Rule: If x is temporal, prioritize group values
        if x_is_temporal and group_column:
            logger.info(f"X column '{x_column}' is temporal, assigning images to group values")
            # Get unique group values
            group_values = []
            for item in data_points:
                if group_column in item and item[group_column] not in group_values:
                    group_values.append(item[group_column])
            
            # Find icons for each unique group value
            for group_value in group_values:
                logger.info(f"Finding icon for group value: {group_value}")
                icon_path = find_best_matching_icon(str(group_value), icon_dir)
                if icon_path:
                    base64_image = image_to_base64(icon_path)
                    if base64_image:
                        images["field"][str(group_value)] = base64_image
        
        # Rule: If x is not temporal or there's no group column, assign to x values
        elif x_column and not x_is_temporal:
            logger.info(f"Assigning images to non-temporal x values: {x_column}")
            # Get unique x values
            x_values = []
            for item in data_points:
                if x_column in item and item[x_column] not in x_values:
                    x_values.append(item[x_column])
            
            # Find icons for each unique x value
            for x_value in x_values:
                logger.info(f"Finding icon for x value: {x_value}")
                icon_path = find_best_matching_icon(str(x_value), icon_dir)
                if icon_path:
                    base64_image = image_to_base64(icon_path)
                    if base64_image:
                        images["field"][str(x_value)] = base64_image
    
    # Find icon for title
    if "title" in metadata:
        title_text = metadata["title"]
        logger.info(f"Finding icon for title: {title_text}")
        icon_path = find_best_matching_icon(title_text, icon_dir)
        if icon_path:
            base64_image = image_to_base64(icon_path)
            if base64_image:
                images["other"]["primary"] = base64_image
    
    # Add images to the result
    result["images"] = images
    logger.info(f"Generated {len(images['field'])} field images and {len(images['other'])} other images")
    
    return result

def process_modules(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process data through all modules 1-6
    
    Args:
        input_data: The input data JSON object
        
    Returns:
        Processed data after running through all modules
    """
    # Apply each module in sequence
    result = module1_chart_type_recommender(input_data)
    result = module2_datafact_generator(result)
    result = module3_title_generator(result)
    result = module4_layout_recommender(result)
    result = module5_color_recommender(result)
    result = module6_image_recommender(result)
    
    return result

def main():
    """
    Main function to run the simplified modules 1-6
    
    If arguments are provided, process the specified input file to the specified output file.
    If no arguments are provided, process all files in test_data/new_data and save to test_data/data.
    """
    parser = argparse.ArgumentParser(description="Simplified ChartPipeline Modules 1-6")
    parser.add_argument("--input", help="Input JSON file path")
    parser.add_argument("--output", help="Output JSON file path")
    
    args = parser.parse_args()
    
    try:
        # If specific input and output are provided, process a single file
        if args.input and args.output:
            logger.info(f"Processing single file: {args.input} -> {args.output}")
            process_single_file(args.input, args.output)
        # Otherwise, process all files in test_data/new_data
        else:
            logger.info("No arguments provided, processing all files in test_data/new_data")
            process_directory()
        
        logger.info("Processing completed successfully")
        return 0
    
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        return 1

def process_single_file(input_path, output_path):
    """
    Process a single input file and save the result to the specified output path
    
    Args:
        input_path: Path to the input JSON file
        output_path: Path to save the output JSON file
    """
    # Load input data
    logger.info(f"Loading input data from {input_path}")
    with open(input_path, 'r', encoding='utf-8') as f:
        input_data = json.load(f)
    
    # Process data through modules 1-6
    output_data = process_modules(input_data)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save output data
    logger.info(f"Saving output data to {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

def process_directory():
    """
    Process all JSON files in test_data/new_data directory and save results to test_data/data
    """
    input_dir = "test_data/new_data"
    output_dir = "test_data/data"
    
    # Check if input directory exists
    if not os.path.exists(input_dir):
        logger.warning(f"Input directory not found: {input_dir}")
        logger.info(f"Creating input directory: {input_dir}")
        os.makedirs(input_dir)
        return
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        logger.info(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir)
    
    # Get all JSON files in the input directory
    input_files = [f for f in os.listdir(input_dir) if f.endswith('.json')]
    
    if not input_files:
        logger.warning(f"No JSON files found in {input_dir}")
        return
    
    logger.info(f"Found {len(input_files)} JSON files to process")
    
    # Process each file
    for filename in input_files:
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)
        
        try:
            logger.info(f"Processing file: {filename}")
            process_single_file(input_path, output_path)
        except Exception as e:
            logger.error(f"Error processing file {filename}: {str(e)}")

if __name__ == "__main__":
    sys.exit(main())
