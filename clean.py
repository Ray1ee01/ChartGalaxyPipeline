import os
import shutil
import argparse

def clean_directory(base_dir):
    """
    清理指定目录下的文件和文件夹
    Args:
        base_dir: 要清理的基础目录
    """
    # 删除基础目录下的所有svg文件
    for file in os.listdir(base_dir):
        if file.endswith('.svg') and os.path.isfile(os.path.join(base_dir, file)):
            os.remove(os.path.join(base_dir, file))
            print(f"已删除: {file}")

    # 扫描所有子目录
    subdirs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    kept_dirs = 0
    
    for subdir in subdirs:
        subdir_path = os.path.join(base_dir, subdir)
        has_svg = False
        
        # 检查子目录是否直接包含svg文件
        for file in os.listdir(subdir_path):
            if file.endswith('.svg'):
                has_svg = True
                break
        
        if has_svg:
            # 保留该目录，但删除指定文件
            kept_dirs += 1
            files_to_remove = ['chart.mask.png', 'chart.html']
            for file in files_to_remove:
                file_path = os.path.join(subdir_path, file)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"已删除: {subdir}/{file}")
        else:
            # 删除整个子目录
            shutil.rmtree(subdir_path)
            print(f"已删除目录: {subdir}")
    
    print(f"\n清理完成,共保留了 {kept_dirs} 个包含SVG文件的子目录")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='清理指定目录下的文件')
    parser.add_argument('--dir', type=str, help='要清理的目录路径,默认为当前目录')
    args = parser.parse_args()
    
    clean_directory(args.dir)
