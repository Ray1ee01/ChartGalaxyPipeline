from PIL import Image
import cv2
import numpy as np

def combine_images(image_path1, image_path2, output_path):
    image1 = Image.open(image_path1)
    image2 = Image.open(image_path2)
    
    width2, height2 = image2.size
    width1, height1 = image1.size
    
    image1_cv = cv2.cvtColor(np.array(image1), cv2.COLOR_RGB2BGR)
    # Resize image2
    new_height1 = int(height1 * (width2 / width1))
    image1_cv_resized = cv2.resize(image1_cv, (width2, new_height1), interpolation=cv2.INTER_AREA)
    
    # Convert back to PIL format
    image1_resized = Image.fromarray(cv2.cvtColor(image1_cv_resized, cv2.COLOR_BGR2RGB))
    
    width1, height1 = image1_resized.size
    
    combined_image = Image.new('RGB', (width2, height2 + height1))
    combined_image.paste(image1_resized, (0, 0))
    combined_image.paste(image2, (0, height1))
    combined_image.save(output_path)
    
    return output_path
