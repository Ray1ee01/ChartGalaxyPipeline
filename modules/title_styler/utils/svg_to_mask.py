import sys
import os
import io
import argparse
import math
from PIL import Image as PILImage, ImageDraw
import cairosvg
import numpy as np
from lxml import etree
import base64

def parse_svg_dimensions(svg_content):
    """解析SVG中的尺寸信息"""
    # print('svg_content: ', svg_content)
    # for debug: 把svg_content写入文件
    svg_content = svg_content.replace('&', '')
    temp_dir = os.environ.get('TEMP_DIR', '.')
    with open(os.path.join(temp_dir, "svg_content.svg"), "w") as f:
        f.write(svg_content)
    # 将&符号替换为&amp;以避免XML解析错误
    root = etree.fromstring(svg_content)
    

    
    # 默认值
    dimensions = {
        'viewBox': [0, 0, 300, 150],
        'width': 300,
        'height': 150
    }
    
    # 解析viewBox
    viewbox = root.get('viewBox')
    if viewbox:
        dimensions['viewBox'] = [float(x) for x in viewbox.replace(',', ' ').split()]
    
    # 解析width和height
    width = root.get('width')
    height = root.get('height')
    
    if width and height:
        # 去掉单位
        dimensions['width'] = float(''.join(c for c in width if c.isdigit() or c == '.'))
        dimensions['height'] = float(''.join(c for c in height if c.isdigit() or c == '.'))
    elif width:
        dimensions['width'] = float(''.join(c for c in width if c.isdigit() or c == '.'))
        # 保持比例
        dimensions['height'] = dimensions['width'] * (dimensions['viewBox'][3] / dimensions['viewBox'][2])
    elif height:
        dimensions['height'] = float(''.join(c for c in height if c.isdigit() or c == '.'))
        # 保持比例
        dimensions['width'] = dimensions['height'] * (dimensions['viewBox'][2] / dimensions['viewBox'][3])
    else:
        # 使用viewBox
        dimensions['width'] = dimensions['viewBox'][2]
        dimensions['height'] = dimensions['viewBox'][3]
    
    return dimensions


def svg_to_mask(svg_content, grid_size=10, content_threshold=0.05, sample_density=36, scale=2):
    """
    将SVG转换为基于网格的mask
    
    参数:
    svg_content - SVG内容字符串
    grid_size - 网格大小
    content_threshold - 内容阈值，当内容占比超过此值时标记为有内容
    sample_density - 采样密度，每个网格单元的采样点数量
    scale - 比例因子，用于提高渲染精度
    
    返回:
    tuple (原始图像, mask图像, mask网格, 网格信息)
    """
    svg_content = svg_content.replace('&', '')
    # 解析SVG尺寸
    dimensions = parse_svg_dimensions(svg_content)
    vbx, vby, vbw, vbh = dimensions['viewBox']
    
    # 计算网格尺寸
    cols = math.ceil(vbw / grid_size)
    rows = math.ceil(vbh / grid_size)
    
    # 渲染SVG到PNG
    canvas_width = int(cols * grid_size * scale)
    canvas_height = int(rows * grid_size * scale)
    
    png_data = cairosvg.svg2png(
        bytestring=svg_content.encode('utf-8'),
        output_width=canvas_width,
        output_height=canvas_height
    )
    
    # 加载图像
    image = PILImage.open(io.BytesIO(png_data))
    image_data = np.array(image)
    
    # 创建mask矩阵和图像
    mask_grid = np.zeros((rows, cols), dtype=bool)
    mask_image = PILImage.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(mask_image)
    
    # 用于调试的画布
    debug_image = image.copy()
    debug_draw = ImageDraw.Draw(debug_image)
    
    # 计算采样步长
    samples_per_row = int(math.sqrt(sample_density))
    step_size = (grid_size * scale) / samples_per_row
    
    grid_info = {
        'total_cells': rows * cols,
        'filled_cells': 0,
        'dimensions': dimensions,
        'grid_size': grid_size,
        'rows': rows,
        'cols': cols
    }
    
    # 生成采样网格坐标
    x_offsets = np.arange(samples_per_row) * step_size
    y_offsets = np.arange(samples_per_row) * step_size
    X, Y = np.meshgrid(x_offsets, y_offsets)
    sample_offsets = np.stack([X.flatten(), Y.flatten()], axis=1)
    
    # 遍历每个网格单元
    for y in range(rows):
        for x in range(cols):
            # 网格在图像上的位置
            grid_x = int(x * grid_size * scale)
            grid_y = int(y * grid_size * scale)
            
            # 绘制网格线（调试用）
            debug_draw.rectangle(
                [(grid_x, grid_y), (grid_x + grid_size * scale, grid_y + grid_size * scale)], 
                outline=(200, 200, 200, 128), 
                width=1, 
                fill=None
            )
            
            # 计算所有采样点坐标
            sample_points = sample_offsets + [grid_x, grid_y]
            sample_points = sample_points.astype(int)
            
            # 过滤掉超出范围的点
            valid_points = (sample_points[:, 0] >= 0) & (sample_points[:, 0] < canvas_width) & \
                         (sample_points[:, 1] >= 0) & (sample_points[:, 1] < canvas_height)
            valid_samples = sample_points[valid_points]
            
            # 获取所有有效采样点的颜色和alpha值
            pixels = image_data[valid_samples[:, 1], valid_samples[:, 0]]
            rgb_values = pixels[:, :3]
            alpha_values = pixels[:, 3]
            
            # 判断有效点：alpha不为0且RGB不都超过250
            is_white = np.all(rgb_values > 250, axis=1)
            is_visible = (alpha_values > 0) & (~is_white)
            content_points = np.sum(is_visible)
            
            # 计算内容比例
            content_ratio = content_points / sample_density
            
            # 在调试图像上显示比例
            text_x = grid_x + (grid_size * scale) // 2
            text_y = grid_y + (grid_size * scale) // 2
            text_color = (255, 0, 0, 255) if content_ratio >= content_threshold else (0, 0, 0, 255)
            debug_draw.text((text_x, text_y), f"{int(content_ratio*100)}%", fill=text_color)
            
            # 如果内容比例超过阈值，则标记为有内容
            if content_ratio >= content_threshold:
                mask_grid[y, x] = True
                grid_info['filled_cells'] += 1
                
                # 在mask图像上绘制矩形
                draw.rectangle(
                    [(grid_x, grid_y), (grid_x + grid_size * scale, grid_y + grid_size * scale)],
                    fill=(0, 0, 255, 128)
                )
                
                # 在调试图像上高亮有内容的网格
                debug_draw.rectangle(
                    [(grid_x, grid_y), (grid_x + grid_size * scale, grid_y + grid_size * scale)],
                    outline=(255, 0, 0, 255),
                    width=2,
                    fill=None
                )
    
    return debug_image, mask_image, mask_grid, grid_info

def main():
    parser = argparse.ArgumentParser(description='SVG到网格Mask转换工具')
    parser.add_argument('svg_file', help='输入SVG文件路径')
    parser.add_argument('--output', '-o', help='输出目录', default='.')
    parser.add_argument('--grid-size', '-g', type=int, default=10, help='网格大小 (默认: 10)')
    parser.add_argument('--threshold', '-t', type=float, default=0.05, help='内容阈值 (0-1, 默认: 0.05)')
    parser.add_argument('--sample', '-s', type=int, default=36, help='采样密度 (默认: 36 = 6x6)')
    parser.add_argument('--scale', type=float, default=2, help='渲染比例因子 (默认: 2)')
    
    args = parser.parse_args()
    
    # 读取SVG文件
    try:
        with open(args.svg_file, 'r', encoding='utf-8') as f:
            svg_content = f.read()
    except Exception as e:
        print(f"无法读取SVG文件: {e}")
        return
    
    # 创建输出目录
    if not os.path.exists(args.output):
        os.makedirs(args.output)
    
    # 生成文件名
    base_name = os.path.splitext(os.path.basename(args.svg_file))[0]
    debug_file = os.path.join(args.output, f"{base_name}_debug.png")
    mask_file = os.path.join(args.output, f"{base_name}_mask.png")
    info_file = os.path.join(args.output, f"{base_name}_info.txt")
    
    # 生成mask
    print(f"处理SVG文件: {args.svg_file}")
    print(f"网格大小: {args.grid_size}, 内容阈值: {args.threshold*100}%, 采样密度: {args.sample}")
    
    debug_image, mask_image, mask_grid, grid_info = svg_to_mask(
        svg_content, 
        grid_size=args.grid_size,
        content_threshold=args.threshold,
        sample_density=args.sample,
        scale=args.scale
    )
    
    # 保存结果
    debug_image.save(debug_file)
    mask_image.save(mask_file)
    print(mask_grid)
    
    # 生成信息文件
    dimensions = grid_info['dimensions']
    with open(info_file, 'w', encoding='utf-8') as f:
        f.write(f"SVG尺寸: {dimensions['width']}x{dimensions['height']}\n")
        f.write(f"ViewBox: {dimensions['viewBox']}\n")
        f.write(f"网格: {grid_info['cols']}×{grid_info['rows']}, 共{grid_info['filled_cells']}/{grid_info['total_cells']}个单元格被标记 ")
        f.write(f"({grid_info['filled_cells']/grid_info['total_cells']*100:.1f}%)\n")
        f.write(f"阈值: {args.threshold*100}%\n")
        f.write(f"白色阈值: 250\n")
    
    print(f"处理完成。调试图像已保存到: {debug_file}")
    print(f"Mask图像已保存到: {mask_file}")
    print(f"信息已保存到: {info_file}")

if __name__ == "__main__":
    main()
