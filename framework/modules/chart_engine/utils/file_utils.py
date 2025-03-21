import os
import uuid
import shutil
import tempfile

# Create a dedicated temporary directory
def ensure_temp_dir():
    """
    Ensures that a temporary directory exists in the current directory
    
    Returns:
        Path to the temporary directory
    """
    tmp_dir = os.path.join(os.getcwd(), "tmp")
    if not os.path.exists(tmp_dir):
        os.makedirs(tmp_dir)
    return tmp_dir

def get_random_filename(prefix="", suffix=""):
    """
    Generate a random filename with an optional prefix and suffix
    
    Args:
        prefix: Optional prefix for the filename
        suffix: Optional suffix for the filename (e.g. file extension)
        
    Returns:
        A unique random filename
    """
    random_id = str(uuid.uuid4())
    return f"{prefix}{random_id}{suffix}"

def create_temp_file(prefix="", suffix="", content=None):
    """
    Create a temporary file with random name in the tmp directory
    
    Args:
        prefix: Optional prefix for the filename
        suffix: Optional suffix for the filename
        content: Optional content to write to the file
        
    Returns:
        Path to the created temporary file
    """
    tmp_dir = ensure_temp_dir()
    filename = get_random_filename(prefix, suffix)
    filepath = os.path.join(tmp_dir, filename)
    
    if content is not None:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return filepath

def create_temp_dir(prefix=""):
    """
    Create a temporary directory with a random name in the tmp directory
    
    Args:
        prefix: Optional prefix for the directory name
        
    Returns:
        Path to the created temporary directory
    """
    tmp_dir = ensure_temp_dir()
    dirname = get_random_filename(prefix=prefix)
    dirpath = os.path.join(tmp_dir, dirname)
    os.makedirs(dirpath)
    return dirpath

def cleanup_temp_file(filepath):
    """
    Delete a temporary file
    
    Args:
        filepath: Path to the temporary file
    """
    if os.path.exists(filepath):
        os.remove(filepath)

def cleanup_temp_dir(dirpath):
    """
    Delete a temporary directory and all its contents
    
    Args:
        dirpath: Path to the temporary directory
    """
    if os.path.exists(dirpath):
        shutil.rmtree(dirpath)

def create_fallback_svg(output_path, width=800, height=600, error_message="Failed to generate chart"):
    """
    Create a simple SVG file with an error message when all other methods fail
    
    Args:
        output_path: Path where to save the SVG file
        width: Width of the SVG
        height: Height of the SVG
        error_message: Error message to display in the SVG
        
    Returns:
        Path to the generated SVG file
    """
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
    <rect width="100%" height="100%" fill="#f8f9fa" />
    <text x="50%" y="40%" font-family="Arial" font-size="20px" text-anchor="middle" font-weight="bold">
        Error Generating
    </text>
    <text x="50%" y="50%" font-family="Arial" font-size="16px" text-anchor="middle">
        {error_message}
    </text>
    <text x="50%" y="60%" font-family="Arial" font-size="14px" text-anchor="middle" fill="#555">
        Please check the console for detailed error messages.
    </text>
</svg>"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    return output_path 