from openai import OpenAI
from io import BytesIO
import random
import re 

client = OpenAI(
    api_key="sk-HGwzhul85auxqDzz6eF39b9eD47347F7A454Ad9e8f1f380d",
    base_url="https://aihubmix.com/v1"
)

def generate_chart_description(df, meta_data, caption_size=30):
    prompt = f"""
    Given the following chart data and context, generate a relevant topic, some key words of the topic, a concise title, and an objective description.

    Chart Data (df):
    {df.head()}

    Context:
    - Page Title: {meta_data['pageTitle']}
    - Title: {meta_data['title']}
    - URL: {meta_data['url']}
    - Text Before Table: {meta_data['textBeforeTable']}
    - Text After Table: {meta_data['textAfterTable']}
    
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

answer_pattern = re.compile(r"\*\*Topic\*\*: (.+)\n\*\*Keywords\*\*: (.+)\n\*\*Title\*\*: (.+)\n\*\*Description\*\*: (.+)")
def get_results(response):
    match = answer_pattern.match(response)
    if match:
        return {
            'topic': match.group(1).strip(),
            'keywords': match.group(2).strip().split(','),
            'title': match.group(3).strip(),
            'caption': match.group(4).strip()
        }
    return None

available_caption_sizes = [10, 20, 30, 40, 50]
def check_topic_and_caption(df, meta_data):
    caption_size = random.choice(available_caption_sizes)
    prompt = generate_chart_description(df, meta_data, caption_size)
    # print(prompt)
    try_num = 0
    while try_num < 5:
      response = ask(prompt)
      results = get_results(response)
      if results:
          break
      try_num += 1
    if not results:
        print("Error: Unable to generate topic and caption.")
        return None
    # print(response)
    # print(wwxxhh) 1015
    print(results, caption_size)
    return results