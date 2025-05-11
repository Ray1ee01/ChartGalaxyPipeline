from openai import OpenAI
from PIL import Image
import base64
from io import BytesIO
from config import client_key, base_url

image_max_size = 512
model_name = 'gpt-4o-mini'

client = OpenAI(
    api_key=client_key,
    base_url=base_url
)

def resize_image(img, max_size=512):
    width, height = img.size
    ratio = min(max_size / width, max_size / height)
    if ratio >= 1:
        return img
    new_width = int(width * ratio)
    new_height = int(height * ratio)
    resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return resized_img
    
def image_to_base64(image_path, target_size=image_max_size):
    with Image.open(image_path) as img:
        # img = img.resize(size)
        img = resize_image(img, target_size)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return img_base64

wwxxhh = 0
def ask(prompt):
    global wwxxhh
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            response = client.chat.completions.create(
              model=model_name,
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

def ask_image(prompt, image_data):
    global wwxxhh
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            response = client.chat.completions.create(
              model=model_name,
              messages=[
                {
                  "role": "user",
                  "content": [
                    {   
                        "type": "text", 
                        "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        },
                    },
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

def chat_with_image(prompts, image_data):
    global wwxxhh
    messages = []
    
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompts[0]
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        }
                    }
                ]
            })
            
            response = client.chat.completions.create(
                model=model_name,
                messages=messages
            )
            
            messages.append({
                "role": "assistant",
                "content": response.choices[0].message.content
            })
            
            wwxxhh += response.usage.total_tokens
            
            for prompt in prompts[1:]:
                messages.append({
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}]
                })
                
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages
                )
                
                messages.append({
                    "role": "assistant",
                    "content": response.choices[0].message.content
                })
                
                wwxxhh += response.usage.total_tokens
            
            return [msg["content"] for msg in messages if msg["role"] == "assistant"]

        except Exception as e:
            number_of_trials += 1
            print(e)
            
    return ['Error!'] * len(prompts)