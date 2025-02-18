from openai import OpenAI
from io import BytesIO
import random
import re 

client = OpenAI(
    api_key="sk-HGwzhul85auxqDzz6eF39b9eD47347F7A454Ad9e8f1f380d",
    base_url="https://aihubmix.com/v1"
)

examples = [
    ("America's Trading Partners", 
    "Trade in Goods by Selected Countries and Areas in 2021"),
    ("Apple or Android Nation?",
    "Mobile operating systems market share in selected countries")
]
# TODO

def dict_to_yaml_string(meta_data):
    yaml_str = ''
    for key, value in meta_data.items():
        yaml_str += f'- {key}: {value}\n'
    return yaml_str

    # - Page Title: {meta_data['pageTitle']}
    # - Title: {meta_data['title']}
    # - URL: {meta_data['url']}
    # - Text Before Table: {meta_data['textBeforeTable']}
    # - Text After Table: {meta_data['textAfterTable']}

def generate_chart_description_bf(df, meta_data, caption_size=30):
    prompt = f"""
    Given the following chart data and context, generate a relevant topic, some key words of the topic, a concise title, and an objective description.

    Chart Data (df):
    {df.head()}

    Context:
    {dict_to_yaml_string(meta_data)}
    
    Requirements:
    1. Topic: Generate a concise topic that summarizes the main theme or insight from the data.
    2. Key words: Generate some key words of the given topic.
    2. Title: Create a title that represents the core message or conclusion of the data analysis.
    3. Description: Write an objective description, similar to a news headline or poster, that summarizes the key background or factual findings. Do not mention word data and specific data points, chart elements, or numbers.
 
    Please return the response in the following format:

    **Topic**: [Your concise topic here (less than 5 words)]
    **Keywords**: [Your key words here (less than 5 words for each key word)]
    **Title**: [Your title here]
    **Description**: [Your objective description here (less than {caption_size} words)]
    """
    return prompt


def generate_chart_description(df, meta_data, caption_size=30):
    prompt = f"""
    Given the following chart data and context, generate a relevant topic, some key words of the topic, a news-style headline, and a subtitle.

    Chart Data (df):
    {df.head()}

    Context:
    {dict_to_yaml_string(meta_data)}
    
    Requirements:
    1. Topic: Generate a concise topic that summarizes the main theme or insight from the data.
    2. Key words: Generate some key words of the given topic.
    3. Headline: Create a news-style headline that captures the key focus of the data, avoiding conclusions. Focus on the main subject or trend. Make it attention-grabbing and informative.
    4. Subtitle: Write an objective description, similar to a news subtitle, that summarizes the key background or factual findings. Do not mention word data and specific data points, chart elements, or numbers.
 
    Please return the response in the following format:

    **Topic**: [Your concise topic here (less than 5 words)]
    **Keywords**: [Your key words here (less than 5 words for each key word)]
    **Headline**: [Your news-style headline here]
    **Subtitle**: [Your supporting subtitle here (less than {caption_size} words)]
    """
    return prompt

def generate_chart_description_exp(df, meta_data, caption_size=30, exp=examples[0]):
    prompt = f"""
    Given the following chart data and context, generate a relevant topic, some key words of the topic, a news-style headline, and a subtitle.

    Chart Data (df):
    {df.head()}

    Context:
    {dict_to_yaml_string(meta_data)}
    
    Requirements:
    1. Topic: Generate a concise topic that summarizes the main theme or insight from the data.
    2. Key words: Generate some key words of the given topic.
    3. Headline: Create a news-style headline that captures the key focus of the data, avoiding conclusions. Focus on the main subject or trend. Make it attention-grabbing and informative.
    4. Subtitle: Write an objective description, similar to a news subtitle, that summarizes the key background or factual findings. Do not mention word data and specific data points, chart elements, or numbers.
    
    Here is an example of a news-style headline and subtitle:
    **Headline**: "{exp[0]}"
    **Subtitle**: "{exp[1]}"

    Please return the response in the following format:

    **Topic**: [Your concise topic here (less than 5 words)]
    **Keywords**: [Your key words here (less than 5 words for each key word)]
    **Headline**: [Your news-style headline here]
    **Subtitle**: [Your supporting subtitle here (less than {caption_size} words)]
    """
    return prompt

wwxxhh = 0
def ask(prompt):
    global wwxxhh
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            response = client.chat.completions.create(
              model="gpt-4o-mini",
              messages=[
                {
                  "role": "user",
                  "content": [
                    {   
                        "type": "text", 
                        "text": prompt},
                  ],
                }
              ]
            )
            wwxxhh += response.usage.total_tokens
            return response.choices[0].message.content

        except Exception as e:
            number_of_trials += 1
            print(e)

    return 'Error!'

# answer_pattern = re.compile(r"\*\*Topic\*\*: (.+)\n\*\*Keywords\*\*: (.+)\n\*\*Title\*\*: (.+)\n\*\*Description\*\*: (.+)")
answer_pattern = re.compile(r"\*\*Topic\*\*: (.+)\n\*\*Keywords\*\*: (.+)\n\*\*Headline\*\*: (.+)\n\*\*Subtitle\*\*: (.+)")

def get_results(response):
    # print(response)
    match = answer_pattern.match(response)
    if match:
        return {
            'topic': match.group(1).strip(),
            'keywords': [keyword.strip() for keyword in match.group(2).strip().split(',')],
            'title': match.group(3).strip(),
            'caption': match.group(4).strip()
        }
    return None

# available_caption_sizes = [10, 20, 30, 40, 50]
# available_caption_sizes = [10, 20, 30]
available_caption_sizes = [10, 20]

def check_topic_and_caption(df, meta_data):
    caption_size = random.choice(available_caption_sizes)
    # random select examples TODO
    example = random.choice(examples)
    # prompt = generate_chart_description(df, meta_data, caption_size)
    prompt = generate_chart_description_exp(df, meta_data, caption_size, example)
    # print(prompt)
    try_num = 0
    while try_num < 5:
      response = ask(prompt)
      results = get_results(response)
    #   print(prompt, results)
    #   exit()
      if results:
          break
      try_num += 1
    if not results:
        print("Error: Unable to generate topic and caption.")
        return None
    # print(response)
    # print(wwxxhh) 1015
    # print(results, caption_size)
    return results

def find_emphasis_phrases(title, meta_data):
    prompt = f"""
    Given the following title and context, find the emphasis phrases in the title.

    Title: {title}
    Context: {dict_to_yaml_string(meta_data)}

    Requirements:
    1. Find the emphasis phrases in the title.
    2. The emphasis phrases should be in the title.
    3. The emphasis phrases should be in the context.\
        
    Please return the response in the following format:
    [
        emphasis_phrase1,
        emphasis_phrase2,
        ...
    ]
    """
    response = ask(prompt)
    
    # 解析response
    response = response.strip()
    response = response[1:-1]
    response = response.split(',')
    response = [phrase.strip() for phrase in response]
    return response

def generate_bgimage_search_keywords(df, meta_data):
    def _get_results(response):
        answer_pattern = re.compile(r"\*\*Search Terms\*\*: \[(.+)\].*\n\*\*搜索词\*\*: \[(.+)\]")
        # print(response)
        match = answer_pattern.match(response)
        if match:
            results = [term.strip() for term in match.group(1).split(',')]
            chinese_results = [term.strip() for term in match.group(2).split(',')]
            return [results, chinese_results]
        return None
    def _get_prompt(df, meta_data):
        prompt = f"""Given the following chart data and context, generate **generic image search terms** optimized for search engines (e.g., Google, Baidu) to find relevant background images. Prioritize broad, visually descriptive keywords that reflect the core theme of the data without referencing specific metrics or jargon.  

**Chart Data (df):**  
{df.head()}  

**Context:**  
{dict_to_yaml_string(meta_data)}  

**Requirements:**  
1. **Search Terms**:  
   - Generate 3–5 search terms that focus on **visual concepts** (e.g., landscapes, objects, symbols) related to the data’s theme.  
   - Avoid numbers, dates, technical terms, or chart-specific language.  
   - Use generic, high-traffic keywords (e.g., "city skyline growth" instead of "urban population increase 2023").  
   - Include terms that imply context (e.g., "industrial factory pollution," "farmers harvesting crops").  

2. Format the terms as phrases (not single keywords) to improve image search relevance.  

**Example:**  
If the data relates to "electric vehicle adoption trends," search terms could be:  
**Search Terms**: [Sustainable transportation cityscape, Electric car charging station, Renewable energy infrastructure]  

**Return format:**  
**Search Terms**: [List your terms here as comma-separated phrases]
**搜索词**: [List your terms in Chinese here as comma-separated phrases]"""
        return prompt
    
    prompt = _get_prompt(df, meta_data)
    try_num = 0
    while try_num < 5:
      response = ask(prompt)
      results = _get_results(response)
    #   print(prompt, results)
    #   exit()
      if results:
          break
      try_num += 1
    if not results:
        print("Error: Unable to generate topic and caption.")
        return None
    return results

def if_has_country_name(data: list):
    # 只选data中的前三个
    data = data[:3]
    data_str = ''
    for item in data:
        for key, value in item.items():
            data_str += f"{key}: {value}\n"
    
    prompt = f"""
    Given the following data, determine if it is about specific countries/regions.
    {data_str}
    
    ### you should return "yes" or "no"
    """
    response = ask(prompt)
    return "Yes" in response or "yes" in response