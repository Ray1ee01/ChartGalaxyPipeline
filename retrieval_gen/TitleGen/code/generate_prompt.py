from openai import OpenAI

def get_prompt( title, 
                color_list, 
                prompt_path = './TitleGen/prompts/generate_prompt_gpt_en.md', 
                save_path = './TitleGen/prompts/generated_output.md'):
    with open(prompt_path, 'r', encoding='utf-8') as file:
        generate_prompt = file.read()
    generate_prompt = generate_prompt.replace("{title}", title)
    color_list_str = ', '.join(color_list)
    generate_prompt = generate_prompt.replace("{color}", color_list_str)

    client = OpenAI(
        api_key="sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9",
        base_url="https://aihubmix.com/v1"
    )
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": generate_prompt
            }
        ]
    )
    #print(response.choices[0])
    generated_text = response.choices[0].message.content
    generated_text = "Generate a text image with the content of \"" + title + "\". " + generated_text
    with open(save_path, 'w', encoding='utf-8') as output_file:
        output_file.write(generated_text)
    return save_path
