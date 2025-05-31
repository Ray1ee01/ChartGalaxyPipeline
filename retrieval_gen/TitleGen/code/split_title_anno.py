from openai import OpenAI
import json
from enum import Enum

class TextClass(Enum):
    ONLY_TITLE = 1
    TITLE_WITH_SHORT_ANNO = 2
    TITLE_WITH_LONG_ANNO = 3

def text_classifier(text):
    texts = []
    texts.append(text)
    title_text, anno_text, words_num = split_title_and_annotation(text)
    if anno_text is None:
        texts.append(title_text)
        return TextClass.ONLY_TITLE, texts
    if words_num < 12:
        texts.append(title_text)
        texts.append(anno_text)
        return TextClass.TITLE_WITH_SHORT_ANNO, texts
    else:
        texts.append(title_text)
        texts.append(anno_text)
        return TextClass.TITLE_WITH_LONG_ANNO, texts

def split_title_and_annotation( text_to_split, prompt_path = 'prompts\split_prompt.md'):
    client = OpenAI(
        api_key="sk-yIje25vOt9QiTmKG4325C0A803A8400e973dEe4dC10e94C6",
        base_url="https://aihubmix.com/v1"
    )
    
    with open(prompt_path, 'r', encoding='utf-8') as file:
        split_prompt = file.read()
    split_prompt = split_prompt.replace("{text}", text_to_split)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "developer", 
                "content": "You extract check result into JSON data."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": split_prompt,
                    }
                ],
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "split_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "only_title": {
                            "description": "Does the text consist only of the title? Answer 'Yes' or 'No'.",
                            "type": "string"
                        },
                        "title_text": {
                            "description": "Only output the title part of the text.",
                            "type": "string"
                        },
                        "other_text": {
                            "description": "If present, output the text excluding the title.",
                            "type": "string"
                        },
                        "additionalProperties": False
                    }
                }
            }
        }
    )

    #print(response.choices[0])

    content = response.choices[0].message.content
    parsed_content = json.loads(content)
    only_title = parsed_content.get('only_title')
    if 'Yes' in only_title:
        title_text = parsed_content.get('title_text')
        return title_text, None, None
    else:
        title_text = parsed_content.get('title_text')
        other_text = parsed_content.get('other_text')
        words = other_text.split()
        words_num = len(words)
        return title_text, other_text, words_num
