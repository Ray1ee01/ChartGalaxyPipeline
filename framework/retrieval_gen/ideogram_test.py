import requests
import os

url = "https://aihubmix.com/ideogram/generate"

payload = { "image_request": {
        "prompt": "3D cartoon, An adorable white owl baby with tilted head, shiny amber eyes with highlight, fluffy body, standing on a trunk with moss and lots of glowing mushrooms, Close up, cinematic lighting, low angle, deep sense of depth. The background is a magical spring landscape, cute and esthetic, huge title design \"Always curious\"", #string 可选
        "negative_prompt": "blurry, bad anatomy, watermark",
        "aspect_ratio": "ASPECT_3_2",  # 可选 include ASPECT_1_1(Default), ASPECT_3_2, ASPECT_2_3, ASPECT_4_3, ASPECT_3_4, ASPECT_16_9, ASPECT_9_16, SPECT_16_10, ASPECT_10_16
        "model": "V_2",
        "num_images": 2, #integer 可选 >=1 <=8 Defaults to 1
        "magic_prompt_option": "AUTO", #string 可选 AUTO, ON, OFF
        #"seed": "2" #integer 可选 >=0 <=2147483647
        "style_type": "RENDER_3D" #string 可选 AUTO/GENERAL/REALISTIC/DESIGN/RENDER_3D/ANIME, 仅适用于 V_2 及以上版本
    } }
headers = {
    "Api-Key": "sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())