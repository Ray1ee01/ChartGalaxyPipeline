from openai import OpenAI
from PIL import Image
import base64
from io import BytesIO


class ChartDesign:
    def __init__(self):
        # self.image_path = "/data1/liduan/generation/chart_system/ChartViewer/src/assets/images/1618549858981868.png"
        self.image_path = "/data1/liduan/generation/chart_system/ChartViewer/src/assets/images/1618549863480285.png"
        self.client = OpenAI(
            api_key="sk-yIje25vOt9QiTmKG4325C0A803A8400e973dEe4dC10e94C6",
            base_url="https://aihubmix.com/v1"
            )  # 初始化OpenAI客户端
        
    def encode_image(self):
        """将图片转换为base64编码"""
        with open(self.image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
        
    def extract_font_sizes(self):
        """从图片中提取不同文本元素的字体大小和行间距"""
        base64_image = self.encode_image()
        
        prompt = """分析这张图表中的文本元素，请提取以下信息：

        字体大小（以像素为单位）：
        1. 标题 (title)
        2. 副标题 (subtitle)
        3. 坐标轴标题 (axis_title)
        4. 坐标轴标签 (axis_label)

        如果标题或副标题有多行，请提取行间距（以像素为单位）：
        1. 标题行间距 (title_line_padding)
        2. 副标题行间距 (subtitle_line_padding)

        只需返回数字，格式为JSON。如果标题或副标题只有一行，对应的行间距返回0。"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        return self._parse_response(response.choices[0].message.content)
    
    def _parse_response(self, content):
        """解析API响应并返回字体大小和行间距字典"""
        try:
            # 这里需要根据实际API返回的格式进行解析
            import json
            return json.loads(content)
        except:
            return {
                "title": 24,  # 默认值
                "subtitle": 18,
                "axis_title": 16,
                "axis_label": 12,
                "title_line_padding": 0,  # 默认行间距
                "subtitle_line_padding": 0
            }

    def get_font(self):
        """获取字体相关属性"""
        return self.extract_font_sizes()
        # if type in self.text_type_list:
        #     return font_sizes[type]
        # else:
        #     return font_sizes['title']
        
    def extract_bar_ratio(self):
        """从图片中提取柱状图的柱子与band的比例，根据图表类型判断是提取宽度还是高度"""
        base64_image = self.encode_image()
        
        prompt = """分析这张柱状图，请提取以下信息：

        1. 首先判断这是垂直柱状图(vertical)还是水平柱状图(horizontal),水平柱状图的多个柱子之间是竖直分布的，垂直柱状图相反
        2. 对于垂直柱状图，提取柱子宽度与band宽度的比例
           对于水平柱状图，提取柱子高度与band高度的比例
           - band指的是分配给每个柱子的总空间
           - 返回一个0到1之间的小数，表示柱子占band的比例

        只需返回数字，格式为JSON。
        例如：
        {
            "chart_type": "vertical",  // 或 "horizontal"
            "bar_band_ratio": 0.75
        }"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=100
        )
        
        return self._parse_bar_ratio_response(response.choices[0].message.content)
    
    def _parse_bar_ratio_response(self, content):
        """解析API响应并返回图表类型和柱子比例"""
        try:
            import json
            return json.loads(content)
        except:
            return {
                "chart_type": "vertical",  # 默认为垂直柱状图
                "bar_band_ratio": 0.75  # 默认值
            }

    def get_bar_ratio(self):
        """获取柱子宽度比例"""
        # return self.extract_bar_ratio()
        # 从0.5-0.95之间随机取一个值
        import random
        return {"bar_band_ratio": random.uniform(0.1, 0.95)}

# chart_design = ChartDesign()
# ratio_info = chart_design.get_bar_ratio()
# print(ratio_info)  # 输出类似 {'bar_band_ratio': 0.75}
