from openai import OpenAI
import base64
import json

def check(  title, 
            prompt_path = './TitleGen/prompts/check_prompt_gpt_en.md', 
            image_path = './TitleGen/images/title/generated_image.png'):
    client = OpenAI(
        api_key="sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9",
        base_url="https://aihubmix.com/v1"
    )
    with open(prompt_path, 'r', encoding='utf-8') as file:
        check_prompt = file.read()
    check_prompt = check_prompt.replace("{title}", title)

    with open(image_path, "rb") as image_file:
        image_data = image_file.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')

    response = client.chat.completions.create(
        model="gpt-4o",
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
                        "text": check_prompt,
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                    },
                ],
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "check_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "result": {
                            "description": "Check whether the sentence displayed correctly in the image. Answer 'Yes' or 'No'.",
                            "type": "string"
                        },
                        "explanation": {
                            "description": "Give the reason why you answer 'yes' or 'no'.",
                            "type": "string"
                        },
                        "text_displayed": {
                            "description": "Give the text displayed in the image.",
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
    result = parsed_content.get('result')
    return result, response.choices[0]
