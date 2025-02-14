import os
import shutil
from ..style_design_modules.infographic_retrieve import InfographicRetriever
from ..style_design_modules.infographic_palette import get_palette


library_path = './src/processors/style_design_modules/all_seeds.json'
model_path = '/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9'

infographic_retriever = InfographicRetriever(library_path, model_path)


def extract_palette(topic_data, cache_dir, image_root, image_paths, default_image_path):
    # 7. get relevant infographics/images
    prompts = ' '.join([topic_data['topic'], ' '.join(topic_data['keywords'])])
    infographics = infographic_retriever.retrieve_similar_entries(prompts, top_k=10)
    info_path = os.path.join(cache_dir, 'infographics')
    # shutil.rmtree(info_path, ignore_errors=True)
    # os.makedirs(info_path)
    # check if the image exists, if exists, copy to the folder
    sel_image_path = None
    for i, info in enumerate(infographics):
        if info in image_paths:
            img_path = os.path.join(image_root, image_paths[info])
            sel_image_path = os.path.join(info_path, info)
            shutil.copy(img_path, sel_image_path)
            break
        else:
            print('Image not found: {}'.format(info))
    if sel_image_path is None:
        sel_image_path = default_image_path
    print("sel_image_path: ", sel_image_path)
    # 8. get color palette from the image TODO color range
    palettes = get_palette(7, True, sel_image_path)
    return palettes
