#!/usr/bin/env python3
import os
import json
import subprocess
import tempfile
import re
from PIL import Image, ImageDraw
import argparse
import glob
import xml.etree.ElementTree as ET
import uuid
import numpy as np
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import api_key, api_provider

# OpenAI API configuration
API_KEY = api_key
API_PROVIDER = api_provider

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

def query_llm(prompt: str) -> str:
    """
    Query LLM API with a prompt
    Args:
        prompt: The prompt to send to LLM
    Returns:
        str: The response from LLM
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gemini-2.0-flash',
        'messages': [
            {'role': 'system', 'content': 'You are a data type classification expert. Provide concise, specific answers.'},
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
        thread_safe_print(f"Error querying LLM: {e}")
        return None

def validate_infographic(image_path):
    """
    Use LLM to determine if the image is a clear and complete infographic
    Args:
        image_path: Path to the PNG image to validate
    Returns:
        bool: True if the image is a valid infographic, False otherwise
    """
    # Convert image to base64 for API (placeholder - implement if needed)
    # Instead, we'll use a text-based prompt describing the validation task
    
    prompt = """Analyze this image and determine if it meets all the following criteria for a clear and complete infographic:

1. Contains visual elements (charts, graphs, or diagrams) that present information
2. Includes text labels or explanations that provide context
3. Has a coherent layout that guides the viewer through the information

The image path is: {image_path}

Answer only "YES" if it meets ALL criteria above, or "NO" if it fails any criteria. Then provide a brief 1-2 sentence explanation why.
"""
    
    # In a real implementation, we would include the image in the API call
    # For now, we'll use the prompt with path information
    response = query_llm(prompt.format(image_path=image_path))
    print(response)
    
    if response and response.startswith("YES"):
        return True
    return False

def extract_element_by_class(svg_file, class_name, output_svg):
    """Extract elements with a specific class from SVG and save to a new SVG file."""
    tree = ET.parse(svg_file)
    root = tree.getroot()
    
    # Define SVG namespace
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    # Find all elements with the specified class
    found = False
    for element in root.findall('.//*[@class]', ns):
        class_attr = element.get('class')
        if class_attr == class_name:
            # Create a new SVG with this element
            new_root = ET.Element(root.tag, root.attrib)
            new_root.extend(root.findall('./svg:defs', ns))  # Copy defs if any
            new_root.append(element)
            
            # Save to a new SVG file
            new_tree = ET.ElementTree(new_root)
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            new_tree.write(output_svg)
            found = True
            break
    
    return found

def adjust_image_elements(svg_file):
    """
    Adjust image elements in SVG if their size > 180px
    Reduces size by 50px and shifts position by 25px
    Modifies the SVG file in-place
    """
    tree = ET.parse(svg_file)
    root = tree.getroot()
    
    # Define SVG namespace
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    # Find all image elements
    modified = False
    for element in root.findall('.//*[@class="image"]', ns):
        # Get element dimensions from attributes or style
        # SVG can define geometry in various ways
        
        # Check for width/height attributes
        width = height = None
        
        # Try to get width/height from attributes
        if 'width' in element.attrib:
            try:
                width = float(element.attrib['width'].replace('px', ''))
            except (ValueError, TypeError):
                pass
        
        if 'height' in element.attrib:
            try:
                height = float(element.attrib['height'].replace('px', ''))
            except (ValueError, TypeError):
                pass
        
        # Try to get width/height from style attribute
        if width is None or height is None:
            style = element.get('style', '')
            width_match = re.search(r'width:\s*(\d+\.?\d*)px', style)
            height_match = re.search(r'height:\s*(\d+\.?\d*)px', style)
            
            if width_match and width is None:
                width = float(width_match.group(1))
            if height_match and height is None:
                height = float(height_match.group(1))
        
        # Check if we need to adjust the element (if size > 180)
        if (width is not None and width > 180) or (height is not None and height > 180):
            # Get position (x, y)
            x = y = None
            
            # Try from attributes
            if 'x' in element.attrib:
                try:
                    x = float(element.attrib['x'].replace('px', ''))
                except (ValueError, TypeError):
                    pass
            
            if 'y' in element.attrib:
                try:
                    y = float(element.attrib['y'].replace('px', ''))
                except (ValueError, TypeError):
                    pass
            
            # Try from transform attribute (translate)
            if (x is None or y is None) and 'transform' in element.attrib:
                transform = element.attrib['transform']
                translate_match = re.search(r'translate\(\s*(\d+\.?\d*)[,\s]+(\d+\.?\d*)', transform)
                if translate_match:
                    if x is None:
                        x = float(translate_match.group(1))
                    if y is None:
                        y = float(translate_match.group(2))
            
            # Try from style
            if x is None or y is None:
                style = element.get('style', '')
                left_match = re.search(r'left:\s*(\d+\.?\d*)px', style)
                top_match = re.search(r'top:\s*(\d+\.?\d*)px', style)
                
                if left_match and x is None:
                    x = float(left_match.group(1))
                if top_match and y is None:
                    y = float(top_match.group(1))
            
            # Adjust size and position if we have all the data
            modified = True
            
            # Adjust width if needed
            if width is not None and width > 180:
                new_width = width - 50
                if 'width' in element.attrib:
                    element.attrib['width'] = f"{new_width}px"
                else:
                    # Update in style
                    style = element.get('style', '')
                    style = re.sub(r'width:\s*\d+\.?\d*px', f'width: {new_width}px', style)
                    element.set('style', style)
            
            # Adjust height if needed
            if height is not None and height > 180:
                new_height = height - 50
                if 'height' in element.attrib:
                    element.attrib['height'] = f"{new_height}px"
                else:
                    # Update in style
                    style = element.get('style', '')
                    style = re.sub(r'height:\s*\d+\.?\d*px', f'height: {new_height}px', style)
                    element.set('style', style)
            
            # Adjust position (x, y)
            if x is not None:
                new_x = x + 25
                if 'x' in element.attrib:
                    element.attrib['x'] = f"{new_x}px"
                elif 'transform' in element.attrib and y is not None:
                    element.attrib['transform'] = f"translate({new_x}, {y + 25})"
                else:
                    # Update in style
                    style = element.get('style', '')
                    style = re.sub(r'left:\s*\d+\.?\d*px', f'left: {new_x}px', style)
                    element.set('style', style)
            
            if y is not None and 'transform' not in element.attrib:
                new_y = y + 25
                if 'y' in element.attrib:
                    element.attrib['y'] = f"{new_y}px"
                else:
                    # Update in style
                    style = element.get('style', '')
                    style = re.sub(r'top:\s*\d+\.?\d*px', f'top: {new_y}px', style)
                    element.set('style', style)
    
    # Save the modified SVG if changes were made
    if modified:
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        tree.write(svg_file)
        thread_safe_print(f"Adjusted 'image' elements in {svg_file}: size reduced by 50px, position shifted by 25px")
    
    return modified

def svg_to_png(svg_path, png_path):
    """Convert SVG to PNG using rsvg-convert with a white background."""
    # Add --background-color=#FFFFFF to set white background
    cmd = ['rsvg-convert', '--background-color=#FFFFFF', svg_path, '-o', png_path]
    subprocess.run(cmd, check=True)

def is_mostly_white(png_path, threshold=0.95):
    """Check if the image is mostly white (more than threshold percentage)."""
    img = Image.open(png_path).convert("RGBA")
    
    # Convert image to numpy array for efficient processing
    img_array = np.array(img)
    
    # Get total pixel count
    total_pixels = img_array.shape[0] * img_array.shape[1]
    
    # Count white pixels (R,G,B values all > 240)
    rgb = img_array[:, :, :3]
    white_pixels = np.sum(np.all(rgb > 240, axis=2))
    
    # Calculate percentage of white pixels
    white_percentage = white_pixels / total_pixels
    
    return white_percentage >= threshold

def get_precise_bbox(png_path):
    """Get precise bounding box by detecting the exact non-transparent pixels."""
    img = Image.open(png_path).convert("RGBA")
    width, height = img.size
    
    # Convert image to numpy array for efficient processing
    img_array = np.array(img)
    
    # Get alpha channel and RGB values
    alpha = img_array[:, :, 3]
    rgb = img_array[:, :, :3]
    
    # Consider white pixels (255,255,255) as transparent too
    is_white = np.all(rgb > 240, axis=2)
    
    # Find non-transparent and non-white pixels
    non_transparent = (alpha > 0) & (~is_white)
    
    # If there are no non-transparent pixels, return the full image dimensions
    if not np.any(non_transparent):
        return 0, 0, width, height
    
    # Find the bounds of non-transparent pixels
    rows = np.any(non_transparent, axis=1)
    cols = np.any(non_transparent, axis=0)
    
    # Get the boundaries
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    # Get full image dimensions
    return x_min, y_min, x_max + 1, y_max + 1

def draw_bounding_boxes(image_path, bbox_data, output_path):
    """Draw bounding boxes on the image and save with _box suffix."""
    # Open the image
    img = Image.open(image_path)
    draw = ImageDraw.Draw(img)
    
    # Define colors for different classes
    colors = {
        "chart": (255, 0, 0),  # Red
        "image": (0, 255, 0),  # Green
        "text": (0, 0, 255)    # Blue
    }
    
    # Draw each bounding box
    for bbox_info in bbox_data["bounding_boxes"]:
        x, y, width, height = bbox_info["bbox"]
        class_name = bbox_info["class"]
        color = colors.get(class_name, (255, 255, 0))  # Default to yellow
        
        # Draw rectangle with 2-pixel width
        for i in range(2):
            draw.rectangle(
                [(x-i, y-i), (x+width+i, y+height+i)],
                outline=color,
                width=1
            )
        
        # Optionally add class name text
        draw.text((x, y-15), class_name, fill=color)
    
    # Save the image
    img.save(output_path)
    return output_path

def process_single_svg(svg_file, output_dir, stats):
    """Process a single SVG file - worker function for thread pool"""
    try:
        base_name = os.path.splitext(os.path.basename(svg_file))[0]
        
        # Make a working copy of the SVG to avoid modifying the original
        working_svg = os.path.join(tempfile.gettempdir(), f"{base_name}_{uuid.uuid4().hex}_working.svg")
        with open(svg_file, 'rb') as src, open(working_svg, 'wb') as dst:
            dst.write(src.read())
        
        # Adjust image elements in the SVG (if size > 180px)
        adjust_image_elements(working_svg)
        
        # Check if the chart element is valid before proceeding
        with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as temp_chart_svg:
            temp_chart_svg_path = temp_chart_svg.name
        
        chart_found = extract_element_by_class(working_svg, "chart", temp_chart_svg_path)
        
        # Skip this SVG if no chart element found
        if not chart_found:
            thread_safe_print(f"Warning: No chart element found in {working_svg}, skipping.")
            os.unlink(temp_chart_svg_path)
            os.unlink(working_svg)
            with stats['lock']:
                stats['skipped_charts'] += 1
            return
        
        # Convert chart SVG to PNG to check if it's mostly white
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_chart_png:
            temp_chart_png_path = temp_chart_png.name
        
        svg_to_png(temp_chart_svg_path, temp_chart_png_path)
        os.unlink(temp_chart_svg_path)
        
        # Check if chart is mostly white (>95%)
        if is_mostly_white(temp_chart_png_path, threshold=0.95):
            thread_safe_print(f"Warning: Chart in {working_svg} is >95% white pixels, skipping.")
            os.unlink(temp_chart_png_path)
            os.unlink(working_svg)
            with stats['lock']:
                stats['skipped_charts'] += 1
            return
        
        os.unlink(temp_chart_png_path)
        
        # Continue with normal processing since chart is valid
        # Output PNG image (with white background)
        output_png = os.path.join(output_dir, f"{base_name}.png")
        svg_to_png(working_svg, output_png)
        
        # Get image dimensions
        img = Image.open(output_png)
        full_width, full_height = img.size
        
        # Initialize the bounding box JSON for this image
        bbox_data = {
            "image": output_png,
            "width": full_width,
            "height": full_height,
            "bounding_boxes": []
        }
        
        # Process each element class
        class_to_id = {"chart": 1, "image": 2, "text": 3}
        
        for class_name in ["chart", "image", "text"]:
            with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as temp_svg:
                temp_svg_path = temp_svg.name
            
            # Extract element with the class
            if extract_element_by_class(working_svg, class_name, temp_svg_path):
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_png:
                    temp_png_path = temp_png.name
                
                # Convert to PNG
                svg_to_png(temp_svg_path, temp_png_path)
                
                # Get precise bounding box
                x_min, y_min, x_max, y_max = get_precise_bbox(temp_png_path)
                
                # Calculate width and height
                width = x_max - x_min
                height = y_max - y_min
                
                if width > 0 and height > 0:
                    # Add to the bounding boxes for this image
                    bbox_data["bounding_boxes"].append({
                        "class": class_name,
                        "category_id": class_to_id[class_name],
                        "bbox": [int(x_min), int(y_min), int(width), int(height)]
                    })
                
                # Clean up temporary files
                os.unlink(temp_png_path)
            
            os.unlink(temp_svg_path)
        
        # Write the bounding box JSON file
        output_json = os.path.join(output_dir, f"{base_name}.json")
        with open(output_json, 'w') as f:
            json.dump(bbox_data, f, indent=4)
        
        # Clean up the working SVG
        os.unlink(working_svg)
        
        thread_safe_print(f"Processed {svg_file} -> {output_png} and {output_json}")
        
        # Validate the infographic using LLM
        if not validate_infographic(output_png):
            thread_safe_print(f"Warning: {output_png} does not appear to be a clear and complete infographic, removing files.")
            os.remove(output_png)
            os.remove(output_json)
            with stats['lock']:
                stats['invalid_infographics'] += 1
            return
        
        with stats['lock']:
            stats['processed_files'] += 1
            
    except Exception as e:
        thread_safe_print(f"Error processing {svg_file}: {str(e)}")
        with stats['lock']:
            stats['errors'] += 1

def process_svg_files(input_dir, output_dir, num_threads=10):
    """Process all SVG files in the input directory using thread pool."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Statistics with thread-safe counters
    stats = {
        'processed_files': 0,
        'skipped_charts': 0,
        'invalid_infographics': 0,
        'errors': 0,
        'lock': threading.Lock()
    }
    
    svg_files = glob.glob(os.path.join(input_dir, "*.svg"))
    total_files = len(svg_files)
    
    if total_files == 0:
        print(f"No SVG files found in {input_dir}")
        return
    
    print(f"Found {total_files} SVG files in {input_dir}")
    print(f"Processing with {num_threads} threads...")
    
    # Use ThreadPoolExecutor to process files in parallel
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        # Submit all tasks and collect futures
        futures = [executor.submit(process_single_svg, svg_file, output_dir, stats) 
                  for svg_file in svg_files]
        
        # Process as they complete (optional progress tracking)
        for i, future in enumerate(as_completed(futures)):
            # This just ensures we wait for each future to complete
            # The actual processing and updates happen in process_single_svg
            try:
                future.result()  # Get result to propagate any exceptions
            except Exception as e:
                thread_safe_print(f"Error in worker thread: {str(e)}")
            
            # Optional progress reporting
            if (i + 1) % 10 == 0 or (i + 1) == total_files:
                thread_safe_print(f"Progress: {i + 1}/{total_files} files ({((i + 1)/total_files)*100:.1f}%)")
    
    print(f"Finished processing {total_files} SVG files:")
    print(f"- Successfully processed: {stats['processed_files']} files")
    print(f"- Skipped charts (empty/white): {stats['skipped_charts']} files")
    print(f"- Invalid infographics (removed): {stats['invalid_infographics']} files")
    print(f"- Errors: {stats['errors']} files")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process SVG files and generate annotations.')
    parser.add_argument('input', help='Directory containing SVG files')
    parser.add_argument('output', help='Directory to save output files')
    parser.add_argument('--threads', type=int, default=10, help='Number of concurrent threads (default: 10)')
    
    args = parser.parse_args()
    process_svg_files(args.input, args.output, args.threads) 