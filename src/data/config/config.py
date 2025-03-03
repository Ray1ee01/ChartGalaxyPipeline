import json
import os


# config_root = "/data1/liduan/generation/chart/chart_pipeline/src/data/config"
# 改绝对路径为相对路径
config_root = os.path.dirname(os.path.abspath(__file__))

CONFIG = {
    "debug": True
}

chart_type_mark_mapping = {
    "bar": "bar",
    "stackedbar": "bar",
    "groupbar": "bar",
}

def update_configs(configs, meta_data):
    if meta_data["axes"]["x_axis"] == "yes":
        value = 0
        x_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
        with open(x_axis_config_path, 'r') as f:
            x_axis_config = json.load(f)
        configs["x_axis"] = x_axis_config
    else:
        value = 31
        x_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
        with open(x_axis_config_path, 'r') as f:
            x_axis_config = json.load(f)
        configs["x_axis"] = x_axis_config
    if meta_data["axes"]["y_axis"] == "yes":
        value = 27
        y_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
        with open(y_axis_config_path, 'r') as f:
            y_axis_config = json.load(f)
        configs["y_axis"] = y_axis_config
    else:
        value = 31
        y_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
        with open(y_axis_config_path, 'r') as f:
            y_axis_config = json.load(f)
        configs["y_axis"] = y_axis_config
    return configs

def load_config(i):
    config_path = os.path.join(config_root, "composite", f"{i}.json")
    with open(config_path, 'r') as f:
        composite_config = json.load(f)
    configs = {}
    for key, value in composite_config.items():
        if key == "layout":
            layout_config_path = os.path.join(config_root, "layout", f"{value}.json")
            with open(layout_config_path, 'r') as f:
                layout_config = json.load(f)
            configs[key] = layout_config
        elif key == "x_axis":
            x_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
            with open(x_axis_config_path, 'r') as f:
                x_axis_config = json.load(f)
            configs[key] = x_axis_config
        elif key == "x_axis_orient":
            x_axis_orient_config_path = os.path.join(config_root, "axis_orient", f"{value}.json")
            with open(x_axis_orient_config_path, 'r') as f:
                x_axis_orient_config = json.load(f)
            configs[key] = x_axis_orient_config
        elif key == "y_axis":
            y_axis_config_path = os.path.join(config_root, "axis", f"{value}.json")
            with open(y_axis_config_path, 'r') as f:
                y_axis_config = json.load(f)
            configs[key] = y_axis_config
        elif key == "y_axis_orient":
            y_axis_orient_config_path = os.path.join(config_root, "axis_orient", f"{value}.json")
            with open(y_axis_orient_config_path, 'r') as f:
                y_axis_orient_config = json.load(f)
            configs[key] = y_axis_orient_config
        elif key == "color":
            color_config_path = os.path.join(config_root, "color", f"{value}.json")
            with open(color_config_path, 'r') as f:
                color_config = json.load(f)
            configs[key] = color_config
        elif key == "icon":
            icon_config_path = os.path.join(config_root, "icon", f"{value}.json")
            with open(icon_config_path, 'r') as f:
                icon_config = json.load(f)
            configs[key] = icon_config
        elif key == "legend":
            legend_config_path = os.path.join(config_root, "legend", f"{value}.json")
            with open(legend_config_path, 'r') as f:
                legend_config = json.load(f)
            configs[key] = legend_config
        elif key == "mark":
            mark_configs = {}
            for mark_type, mark_value in value.items():
                mark_config_path = os.path.join(config_root, "mark", mark_type, f"{mark_value}.json")
                with open(mark_config_path, 'r') as f:
                    mark_config = json.load(f)
                mark_configs[mark_type] = mark_config
            configs[key] = mark_configs
        elif key == "annotation":
            annotation_config_path = os.path.join(config_root, "annotation", f"{value}.json")
            with open(annotation_config_path, 'r') as f:
                annotation_config = json.load(f)
            configs[key] = annotation_config
        elif key == "chart_size":
            chart_size_config_path = os.path.join(config_root, "chart_size", f"{value}.json")
            with open(chart_size_config_path, 'r') as f:
                chart_size_config = json.load(f)
            configs[key] = chart_size_config
        elif key == "image_overlay":
            image_overlay_config = {}
            for mark_type, mark_value in value.items():
                image_overlay_config_path = os.path.join(config_root, "image_overlay", mark_type, f"{mark_value}.json")
                with open(image_overlay_config_path, 'r') as f:
                    image_overlay_config = json.load(f)
                image_overlay_config[mark_type] = image_overlay_config
            configs[key] = image_overlay_config
    return configs

if __name__ == "__main__":
    configs = load_config(0)
    print(configs)
