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
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import sys

# Add project root to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

def get_element_bbox(svg_file, element):
    """Get bounding box for a single SVG element."""
    # Create a temporary SVG with just this element
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as temp_svg:
        temp_svg_path = temp_svg.name
    
    # Create a new SVG with just this element
    tree = ET.parse(svg_file)
    root = tree.getroot()
    new_root = ET.Element(root.tag, root.attrib)
    new_root.extend(root.findall('./svg:defs', {'svg': 'http://www.w3.org/2000/svg'}))  # Copy defs
    
    # If it's a text element, make sure it's black for better bounding box detection
    if element.tag.endswith('text') or element.get('class') == 'text':
        ensure_text_is_black(element)
    
    new_root.append(element)
    
    # Save the temporary SVG
    new_tree = ET.ElementTree(new_root)
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    new_tree.write(temp_svg_path)
    
    # Convert to PNG
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_png:
        temp_png_path = temp_png.name
    svg_to_png(temp_svg_path, temp_png_path)
    
    # Get bounding box
    x_min, y_min, x_max, y_max = get_precise_bbox(temp_png_path)
    
    # Clean up
    os.unlink(temp_svg_path)
    os.unlink(temp_png_path)
    
    return x_min, y_min, x_max - x_min, y_max - y_min

def ensure_text_is_black(element):
    """Ensure text elements are black for better bounding box detection."""
    # Set fill to black for the element
    element.set('fill', '#000000')
    
    # Process any child text elements (tspan, etc.)
    for child in element:
        if child.tag.endswith('text') or child.tag.endswith('tspan'):
            child.set('fill', '#000000')
    
    # Remove any fill opacity if present
    if 'fill-opacity' in element.attrib:
        del element.attrib['fill-opacity']
    
    # If there's a style attribute, modify it to ensure black fill
    if 'style' in element.attrib:
        style = element.get('style', '')
        # Replace any fill color definition
        style = re.sub(r'fill:\s*[^;]+;', 'fill: #000000;', style)
        # If there's no fill definition, add one
        if 'fill:' not in style:
            style += ';fill: #000000;'
        element.set('style', style)

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
    for bbox_info in bbox_data:
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

def extract_image_elements(svg_file, output_svg):
    """Extract all image elements from SVG and save to a new SVG file."""
    tree = ET.parse(svg_file)
    root = tree.getroot()
    
    # Define SVG namespace
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    # Find all image elements
    image_elements = root.findall('.//svg:image', ns)
    
    if not image_elements:
        return False
    
    # Create a new SVG with all found image elements
    new_root = ET.Element(root.tag, root.attrib)
    new_root.extend(root.findall('./svg:defs', ns))  # Copy defs if any
    
    # Add all found image elements to the new SVG
    for element in image_elements:
        new_root.append(element)
    
    # Save to a new SVG file
    new_tree = ET.ElementTree(new_root)
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    new_tree.write(output_svg)
    
    return True

def get_accumulated_transform(element, tree, ns):
    """Get accumulated transform translation from all parent elements."""
    total_x = 0
    total_y = 0
    
    thread_safe_print(f"Starting get_accumulated_transform for element: {element.tag}")
    
    # Get all ancestors of the element
    ancestors = []
    current = element
    while current is not None:
        thread_safe_print(f"Processing ancestor: {current.tag}")
        ancestors.append(current)
        # Find parent by searching from root
        parent = None
        for parent_candidate in tree.getroot().iter():
            if current in list(parent_candidate):
                parent = parent_candidate
                break
        current = parent
    
    thread_safe_print(f"Found {len(ancestors)} ancestors")
    
    # Process each ancestor (excluding the element itself)
    for ancestor in ancestors[1:]:  # Skip the element itself
        thread_safe_print(f"Checking transform for ancestor: {ancestor.tag}")
        # Check for transform attribute
        transform = ancestor.get('transform', '')
        if transform:
            thread_safe_print(f"Found transform: {transform}")
            # Look for translate(x,y) in transform
            translate_match = re.search(r'translate\(\s*([-\d.]+)[,\s]+([-\d.]+)', transform)
            if translate_match:
                total_x += float(translate_match.group(1))
                total_y += float(translate_match.group(2))
                thread_safe_print(f"Added translation: x={translate_match.group(1)}, y={translate_match.group(2)}")
    
    thread_safe_print(f"Final accumulated transform: x={total_x}, y={total_y}")
    return total_x, total_y

def process_single_svg(svg_file, output_dir, stats):
    """Process a single SVG file - worker function for thread pool"""
    try:
        thread_safe_print(f"\nProcessing file: {svg_file}")
        base_name = os.path.splitext(os.path.basename(svg_file))[0]
        
        # Parse the SVG file
        thread_safe_print("Parsing SVG file...")
        tree = ET.parse(svg_file)
        root = tree.getroot()
        ns = {'svg': 'http://www.w3.org/2000/svg'}
        
        # Check if there's a chart element
        thread_safe_print("Checking for chart elements...")
        chart_elements = root.findall('.//*[@class="chart"]', ns)
        if not chart_elements:
            thread_safe_print(f"Warning: No chart element found in {svg_file}, skipping.")
            with stats['lock']:
                stats['skipped_charts'] += 1
            return
        
        # Make a copy of the SVG with all text elements turned black for processing
        modified_svg_file = os.path.join(output_dir, f"{base_name}_black_text.svg")
        # Deep copy the tree
        process_tree = ET.parse(svg_file)
        process_root = process_tree.getroot()
        
        # Find all text elements and make them black
        thread_safe_print("Converting text elements to black for better detection...")
        text_elements = process_root.findall('.//svg:text', ns) + process_root.findall('.//*[@class="text"]', ns)
        for text_element in text_elements:
            ensure_text_is_black(text_element)
        
        # Save the modified SVG
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        process_tree.write(modified_svg_file)
        
        # Use the modified SVG for bounding box detection
        svg_file_for_detection = modified_svg_file
        
        # Convert the whole SVG to PNG
        thread_safe_print("Converting SVG to PNG...")
        output_png = os.path.join(output_dir, f"{base_name}.png")
        svg_to_png(svg_file, output_png)  # Use original for the main output
        
        # Get image dimensions
        thread_safe_print("Getting image dimensions...")
        img = Image.open(output_png)
        full_width, full_height = img.size
        thread_safe_print(f"Image dimensions: {full_width}x{full_height}")
        
        # Initialize the bounding box JSON for this image
        bbox_data = {
            "image": output_png,
            "width": full_width,
            "height": full_height,
            "bounding_boxes": []
        }
        
        # Process each element class
        class_to_id = {"chart": 1, "image": 2, "text": 3}
        
        # Process chart and text elements (top-level)
        thread_safe_print("Processing chart and text elements...")
        for class_name in ["chart", "text"]:
            elements = process_root.findall(f'.//*[@class="{class_name}"]', ns)
            thread_safe_print(f"Found {len(elements)} {class_name} elements")
            for element in elements:
                thread_safe_print(f"Processing {class_name} element: {element.tag}")
                x_min, y_min, width, height = get_element_bbox(svg_file_for_detection, element)
                if width > 0 and height > 0:
                    bbox_data["bounding_boxes"].append({
                        "class": class_name,
                        "category_id": class_to_id[class_name],
                        "bbox": [int(x_min), int(y_min), int(width), int(height)]
                    })
        
        # Process image elements (只处理一级元素)
        thread_safe_print("Processing image elements...")
        image_elements = process_root.findall('./svg:image', ns)  # 只查找一级元素
        thread_safe_print(f"Found {len(image_elements)} image elements")
        for element in image_elements:
            thread_safe_print(f"Processing image element: {element.tag}")
            # Get accumulated transform from all parents
            translate_x, translate_y = get_accumulated_transform(element, process_tree, ns)
            thread_safe_print(f"Accumulated transform for image: x={translate_x}, y={translate_y}")
            
            # Create a temporary SVG with just this image element
            with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as temp_svg:
                temp_svg_path = temp_svg.name
            
            # Create a new SVG with just this image element
            new_root = ET.Element(process_root.tag, process_root.attrib)
            # Don't copy defs to avoid conflicts
            new_root.append(element)
            
            # Save the temporary SVG
            new_tree = ET.ElementTree(new_root)
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            new_tree.write(temp_svg_path)
            
            # Convert to PNG
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_png:
                temp_png_path = temp_png.name
            svg_to_png(temp_svg_path, temp_png_path)
            
            # Get precise bounding box
            x_min, y_min, x_max, y_max = get_precise_bbox(temp_png_path)
            thread_safe_print(f"Bounding box for image: x_min={x_min}, y_min={y_min}, x_max={x_max}, y_max={y_max}")
            
            # Calculate width and height
            width = x_max - x_min
            height = y_max - y_min
            
            if width > 0 and height > 0:
                # Add accumulated transform to the bounding box position
                bbox_data["bounding_boxes"].append({
                    "class": "image",
                    "category_id": class_to_id["image"],
                    "bbox": [int(x_min + translate_x), int(y_min + translate_y), int(width), int(height)]
                })
            
            # Clean up temporary files
            os.unlink(temp_png_path)
            os.unlink(temp_svg_path)
        
        # Clean up the modified SVG after processing
        os.unlink(svg_file_for_detection)
        
        # Write the bounding box JSON file
        thread_safe_print("Writing JSON file...")
        output_json = os.path.join(output_dir, f"{base_name}.json")
        with open(output_json, 'w') as f:
            json.dump(bbox_data, f, indent=4)
        
        # Generate PNG with bounding boxes
        thread_safe_print("Generating PNG with bounding boxes...")
        output_png_with_boxes = os.path.join(output_dir, f"{base_name}_with_boxes.png")
        draw_bounding_boxes(output_png, bbox_data["bounding_boxes"], output_png_with_boxes)
        
        thread_safe_print(f"Successfully processed {svg_file} -> {output_png}, {output_png_with_boxes} and {output_json}")
        
        with stats['lock']:
            stats['processed_files'] += 1
            
    except Exception as e:
        thread_safe_print(f"Error processing {svg_file}: {str(e)}")
        import traceback
        thread_safe_print("Traceback:")
        thread_safe_print(traceback.format_exc())
        with stats['lock']:
            stats['errors'] += 1

def process_svg_files(input_dir, output_dir, num_threads=10):
    """Process all SVG files in the input directory using thread pool."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Statistics with thread-safe counters
    stats = {
        'processed_files': 0,
        'skipped_charts': 0,
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
    print(f"- Errors: {stats['errors']} files")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process SVG files and generate annotations.')
    parser.add_argument('input', help='Directory containing SVG files')
    parser.add_argument('output', help='Directory to save output files')
    parser.add_argument('--threads', type=int, default=5, help='Number of concurrent threads (default: 10)')
    
    args = parser.parse_args()
    process_svg_files(args.input, args.output, args.threads) 