from generate_title_image import get_title
from generate_annotation_image import get_image_lines, break_lines
from combine_title_anno import combine_images
from split_title_anno import *
from crop_image import crop

def get_image_only_title(texts, bg_hex, save_path = 'images/result/generated.png', prompt_times = 2, image_times = 4, image_res = "RESOLUTION_1536_640"):
    title_text = texts[0]
    succ, save_path = get_title(title=title_text, bg_hex=bg_hex, save_path=save_path, prompt_times = prompt_times, image_times = image_times, image_res = image_res)
    if succ == 0:
        return None
    return save_path

def get_image_with_short_annotation(texts, bg_hex, prompt_times = 2, image_times = 4, image_res = "RESOLUTION_1536_640", save_path = 'images/result/generated.png'):
    title_text = texts[0]
    succ, _ = get_title(title=title_text, bg_hex=bg_hex, save_path=save_path, prompt_times = prompt_times, image_times = image_times, image_res = image_res)
    if succ == 0:
        return get_image_with_long_annotation(texts, bg_hex, prompt_times = prompt_times, image_times = image_times, title_res = image_res, save_path = save_path)
    return save_path

def get_image_with_long_annotation(texts, bg_hex, prompt_times = 2, image_times = 4, title_res = "RESOLUTION_1536_640", title_path = 'images/title/generated_image.png', save_path = 'images/result/generated.png'):
    title_text = texts[1]
    anno_text = texts[2]
    succ, _ = get_title(title=title_text, bg_hex=bg_hex, prompt_times = prompt_times, image_times = image_times, image_res = title_res, save_path=title_path)
    if succ == 0:
        return None
    anno_lines = break_lines(anno_text)
    anno_path = get_image_lines(anno_lines, title_image_path=title_path, save_folder='images/annotation')
    crop(image_path=anno_path, edge=10)
    combine_images(title_path, anno_path, save_path)
    return save_path

def get_whole_image(text, bg_hex, prompt_times = 2, image_times = 4, save_path = 'images/result/generated.png'):
    text_type, texts = text_classifier(text)
    print("Text type: ", text_type)
    if text_type == TextClass.ONLY_TITLE:
        res = get_image_only_title(texts=texts, bg_hex=bg_hex, save_path=save_path, prompt_times=prompt_times, image_times=image_times)
    elif text_type == TextClass.TITLE_WITH_SHORT_ANNO:
        res = get_image_with_short_annotation(texts=texts, bg_hex=bg_hex, save_path=save_path, prompt_times=prompt_times, image_times=image_times)
    elif text_type == TextClass.TITLE_WITH_LONG_ANNO:
        res = get_image_with_long_annotation(texts=texts, bg_hex=bg_hex, save_path=save_path, prompt_times=prompt_times, image_times=image_times)
    return res

m_title = "California drought conditions 2000-2025. Climate change is increasing the intensity and frequency of severe droughts and wildfires in California through rising temperatures, drier conditions, and more extreme weather patterns."#"American's beer consumption"#"California drought conditions 2000-2025. Climate change is increasing the intensity and frequency of severe droughts and wildfires in California through rising temperatures, drier conditions, and more extreme weather patterns."#"Top universities by startup founders. PitchBook ranks universities by the number of alumni entrepreneurs who have raised venture capital in the last decade."#"How much oil do electric vehicles save? When vehicles shift toward electric, the oil that would have been used by their combustion engine counterparts is no longer needed, displacing oil demand with electricity."#"Countries with the most battery capacity. Grid-scale battery energy storage systems (BESS) experienced a breakthrough in 2023, more than doubling within a single year-a development that could have profound implications worldwide for the energy transition."#"The gold-to-oil ratio 1946-2024. The gold-to-oil ratio is the number of crude oil barrels equivalent to one troy ounce of gold."#"Countries with the most battery capacity. Grid-scale battery energy storage systems (BESS) experienced a breakthrough in 2023, more than doubling within a single year-a development that could have profound implications worldwide for the energy transition."#"California drought conditions 2000-2025. Climate change is increasing the intensity and frequency of severe droughts and wildfires in California through rising temperatures, drier conditions, and more extreme weather patterns."#"Top universities by startup founders. PitchBook ranks universities by the number of alumni entrepreneurs who have raised venture capital in the last decade."#"Race to Net Zero. Emission reduction goals by country in 2024"#"Uaw strike locations by company"#"Top universities by startup founders. PitchBook ranks universities by the number of alumni entrepreneurs who have raised venture capital in the last decade."#"Visualizing gold bull markets & bear markets 1970-2024"#"ANNUAL MEDIAN SALARY BY EDUCATION LEVEL"#"Where millennials are buying the most homes"#"Countries with the highest proportion of immigrants"#"California Drought Conditions 2000-2025"#"Chrome's rise to browser dominance. Global market share of the most popular internet browsers"
m_bg = "#ff6a00"
res = get_whole_image(text=m_title, bg_hex=m_bg, save_path = 'images/result/generated.png', prompt_times = 2, image_times = 4)
if res is None:
    print("Failed")
else:
    print("Succeed, saved at", res)
