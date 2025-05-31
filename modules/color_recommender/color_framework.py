import colour, json, random, os
import numpy as np
from pathlib import Path
import sys

# 获取当前文件的绝对路径
current_file = Path(__file__).resolve()

# 获取项目根目录路径 (假设config.py在根目录)
project_root = current_file.parent.parent.parent

# 将项目根目录添加到Python路径中
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from config import sentence_transformer_path, infographic_library_path, infographic_image_path, color_cache_path, test_c2t_root
from llm_api import ask, ask_image
from infographic_retrieve import InfographicRetriever

ifg_retriever = InfographicRetriever(sentence_transformer_path, infographic_library_path, infographic_image_path)

encoding_prompt = """You are a data visualization expert. Based on the provided JSON data description for a chart, recommend appropriate color encodings that best represent the data.

Input JSON contains:
- Chart title, description and main insight
- Column definitions with names, importance, descriptions and roles (x, y, group, etc.)
- Data samples
- Chart type specification
- Data format details

Analyze the data and provide color encoding recommendations in the following JSON format:

{
  "color_encoding_options": [
    // Array of possible encoding columns in recommended priority order
    // Each item should be a column role from input JSON or "none"
    // IMPORTANT: Only include "none" if using the same color would NOT result in information loss
    // If different colors are needed to distinguish data points, "none" should not be included
  ],
  "recommendations": [
    // recommended choices for each column
    {
      "color_encoding_option": "column_role",
      "explanation": "Explanation of why this encoding is appropriate",
      "color_scheme": "monochrome|dual-color|colorful",
      "confidence": 0.8
    }
  ]
}

For color schemes:
- "monochrome": Single color with variations in saturation/lightness
- "dual-color": Two contrasting colors (e.g., blue/orange)
- "colorful": Multiple distinct colors

Consider:
1. Semantic meaning of data (sentiments, categories, etc.)
2. Number of distinct groups/categories
3. Chart type and visual clarity

"""

append_info = """
The JSON data is: {json_data}
"""

encode_result_case = """```json
{
  "color_encoding_options": [
    "group"
  ],
  "recommendations": [
    {
      "color_encoding_option": "group",
      "explanation": "Encoding 'Sentiment' with color is crucial for distinguishing between positive, neutral, and negative headline shares within each person's stacked bar.  Differentiation is essential to accurately perceive the proportions of each sentiment.",
      "color_scheme": "colorful",
      "confidence": 0.95
    }
  ]
}
```
"""

judge_prompt = '''You are an expert in color theory and visual design. You will receive the following information:
1. A chart title: {title}
2. A brief description of the chart’s subject: {description}
3. A list of chart columns or data categories: {columns}
4. A palette with following hex color: {colors}

Your task is to evaluate how suitable this palette is for the chart based on emotional and thematic appropriateness. 
For instance, if the chart addresses a serious topic, darker or more subdued tones might be more fitting; if the topic is about environmental awareness, shades of green may be preferable.

Please provide:
- An overall suitability score from 1 to 5 (with 5 indicating an excellent match and 1 indicating a poor match) for the palette.
- Explanation for the score from any issues of emotional or thematic appropriateness.
'''

judge_return_case = '''

Return your assessment in plain text, following the json format:
{
    "score": 4,
    "Explanation": "The palette is well-suited for the chart's subject matter, with a range of colors that are both visually appealing and thematically appropriate. The colors are bright and engaging, which is ideal for a chart that aims to capture the reader's attention."
}

Thank you!'''



cache_color_results = None
def load_cache_results(indexes):
    global cache_color_results
    if cache_color_results is None:
        with open(color_cache_path, 'r') as f:
            cache_color_results = json.load(f)
    return [cache_color_results[i] for i in indexes]

class ColorFramework(object):
    def __init__(self, data_info):
        self.data_info = data_info
        self.color_schemes = self.__get_color_encoding() # TODO: may add error handling

    def __get_color_encoding(self):
        # return dict if success, None if failed
        prompt = encoding_prompt + append_info.format(json_data=self.data_info)
        response = ask(prompt)
        # response = encode_result_case
        try:
            response = json.loads(response)
        except Exception as e:
            response = response.split('```json')[1].split('```')[0]
            response = json.loads(response)
        print(response)

        options = response['color_encoding_options']
        recommendations = response['recommendations']
        res = []
        for recomd in recommendations:
            option = recomd['color_encoding_option']
            column_id = -2
            if option == 'none':
                column_id = -1
            else:
                for i, column in enumerate(self.data_info['columns']):
                    if column['role'] == option:
                        column_id = i
                        break
            if column_id == -2:
                print('No column name existed')
                return None
            res.append({
                'column_id': column_id,
                'column_name': self.data_info['columns'][column_id]['name'],
                'column_role': option,
                'color_scheme': recomd['color_scheme'],
                'confidence': recomd['confidence']
            })
        return res
    
    def load_scheme_list(self):
        return self.color_schemes
    
    def get_infographic_palette(self, scheme_id, topk_num=20, query_threshold=0.3, valid_threshold=3.0, random_seed=-1):
        # return list if success, None if failed
        scheme = self.color_schemes[scheme_id]
        search_query = f"{self.data_info['title']} {self.data_info['description']} {self.data_info['main_insight']} {self.data_info['columns'][scheme['column_id']]['name']}"
        # 1. first retrieve by semantic
        results = ifg_retriever.retrieve_similar_entries(search_query, top_k=topk_num)
        max_similarity = results[0][1]
        results_f = [r for r in results if r[1] >= query_threshold * max_similarity]

        # 2. filter color mode
        results_ids = [r[2] for r in results_f]
        palettes = load_cache_results(results_ids)
        pkg_palettes = zip(results_f, palettes)
        filter_palettes = [palette for palette in pkg_palettes if palette[1]['mode'] == scheme['color_scheme']]
        # print(len(filter_palettes))
        # print(filter_palettes)
        # print(results_f)
        print('filter_palettes:', filter_palettes)

        # 3. judge the palette score
        scores = []
        for palette in filter_palettes:
            prompt = judge_prompt.format(title=self.data_info['title'], description=self.data_info['description'], columns=self.data_info['columns'], colors=palette[1]['main_color']) + judge_return_case
            # print(prompt); exit()
            response = ask(prompt)
            # print(response)
            try:
                try:
                    response = json.loads(response)
                except Exception as e:
                    # from IPython import embed
                    # embed()
                    response = response.split('```json')[1].split('```')[0]
                    response = json.loads(response)
            except:
                response = {'score': 0, 'Explanation': 'Error'}
            score = response['score']
            scores.append(score)
        
        conclusion = zip(filter_palettes, scores)
        valid_palettes = [c[0] for c in conclusion if c[1] >= valid_threshold]
        print('find suitable results:', len(valid_palettes))
        if len(valid_palettes) == 0:
            print('No suitable palette found')
            return None
        # save all valid palettes 
        if random_seed == -1:
            return valid_palettes[0][1]
        else:
            random.seed(random_seed)
            return random.choice(valid_palettes)[1]


def test_ColorFramework():
    data_file = os.path.join(test_c2t_root, "127.json")
    data_info = json.load(open(data_file, 'r'))
    # 1. input data_info
    cf = ColorFramework(data_info)
    # print(cf.data_info)
    print(cf.get_infographic_palette(0))

    # {'mode': 'colorful', 'color_list': ['#4ECBEE', '#FFB51F', '#DC776A', '#3465B1'], 'main_color': ['#4ECBEE', '#FFB51F', '#DC776A', '#3465B1'], 'bcg': '#F2EDEE', 'context_colors': ['#AFAFAF', '#86988B', '#EFDEBA', '#596873', '#2F4455'], 'similar_to_bcg': [], 'other_colors': []}