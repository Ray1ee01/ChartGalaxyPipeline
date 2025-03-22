import json
from facts import FactController
from facts import DataFactToTextConverter

INPUT_FILE = "/home/lizhen/ChartPipeline/src/processors/title_generator_modules/tabular_data_v2/merged.json"
OUTPUT_FILE = "/home/lizhen/ChartPipeline/src/processors/title_generator_modules/data_with_data_facts_rules.json"
TOP_K = 5

def process_one_chart(chart_data):
    controller = FactController()
    controller.run_all(chart_data)
    all_facts = controller.get_all_facts()

    # 获取所有有分数的 fact，排序取 top-k
    scored_facts = []
    for fact_type, fact_list in all_facts.items():
        for fact in fact_list:
            if fact.score is not None:
                scored_facts.append((fact.score, fact_type, fact))
    scored_facts.sort(reverse=True, key=lambda x: x[0])
    top_facts = scored_facts[:TOP_K]

    # 转成自然语言
    converter = DataFactToTextConverter()
    return [text for _, _, text in converter.convert_facts_to_text(top_facts)]

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data_dict = json.load(f)  # 顶层是字典结构，如 {"0": {...}, "1": {...}}

    print(f"Loaded {len(data_dict)} chart entries from top-level dict.")

    processed_count = 0
    for chart_id, chart in data_dict.items():
        if not isinstance(chart, dict):
            continue  # 跳过无效条目

        try:
            facts = process_one_chart(chart)
            chart["data_facts"] = facts
            processed_count += 1
        except Exception as e:
            chart["data_facts"] = []
            print(f"[Error] Chart #{chart_id}: {e}")

    print(f"✅ Processed {processed_count} charts.")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data_dict, f, indent=2, ensure_ascii=False)

    print(f"✅ Output written to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()