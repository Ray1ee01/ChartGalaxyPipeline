from openai import OpenAI
from PIL import Image
import base64
from io import BytesIO
import random


class FontDesign:
    def __init__(self):
        self.text_type_list = ['title', 'subtitle', 'axis_title', 'axis_label']
        self.image_path = "/data1/liduan/generation/chart_system/ChartViewer/src/assets/images/1618549858981868.png"
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
            print('content: ', content)
            return json.loads(content)
        except:
            return {
                "title": 15,  # 默认值
                "subtitle": 11,
                "axis_title": 12,
                "axis_label": 10,
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
        
# font_design = FontDesign()
# print(font_design.get_font())