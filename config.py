import os

data_dir = '/data1/liduan/generation/chart/chart_pipeline/src/data'
image_root_path = "/data3/yukai/datasets/infographic_data/check_202501022351"
feature_root_path = '/data1/liduan/jiashu/icon_cleaner/final_feat'
raw_images_path = "/data1/liduan/generation/chart/iconset/colored_icons_new"
project_dir = '/data1/liduan/generation/chart/chart_pipeline'
sentence_transformer_path = "/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"
logo_path = '/data1/jiashu/data/logo_icons/images/svg'
flag_path = '/data1/jiashu/data/flag_icons'

data_save_dir = os.path.join(project_dir, 'src', 'data')
chart_data_path = os.path.join(project_dir, 'src', 'data', 'chart_to_table', 'test_set')
cache_dir = os.path.join(project_dir, 'src', 'cache')
