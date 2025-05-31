import json
import os
import random
from collections import Counter
import threading

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

# 创建一个新的输出文件锁
output_file_lock = threading.Lock()

# 实时写入到文件
def write_to_file(data, output_file):
    with output_file_lock:
        with open(output_file, 'a', encoding='utf-8') as out_f:
            json.dump(data, out_f, ensure_ascii=False)
            out_f.write('\n')

def main():
    # 读取test_filter.jsonl文件
    samples_by_category = {}
    category_subcategory_counter = Counter()
    
    # 读取文件内容
    with open('test_filter.jsonl', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    thread_safe_print(f"读取了 {len(lines)} 条数据")
    
    # 首先统计各category-subcategory的数量
    for line in lines:
        data = json.loads(line)
        metadata = data['metadata']
        category = metadata['category']
        subcategory = metadata['subcategory']
        cat_subcat = f"{category} - {subcategory}"
        
        # 统计数量
        category_subcategory_counter[cat_subcat] += 1
        
        # 将样本按category-subcategory分组
        if cat_subcat not in samples_by_category:
            samples_by_category[cat_subcat] = []
        samples_by_category[cat_subcat].append(data)
    
    # 计算总数
    total = sum(category_subcategory_counter.values())
    
    # 打印category-subcategory统计
    print("\n=== Category-Subcategory 统计 ===")
    for cat_subcat, count in category_subcategory_counter.most_common():
        percentage = count / total * 100
        print(f"{cat_subcat}: {count} ({percentage:.1f}%)")
    
    # 确定top5和top10
    top_categories = [cat for cat, _ in category_subcategory_counter.most_common()]
    top5 = set(top_categories[:5])
    top10 = set(top_categories[:10])
    
    # 创建新的采样输出文件（清空已有内容）
    output_file = 'test_sampled.jsonl'
    with open(output_file, 'w', encoding='utf-8') as out_f:
        pass
    
    # 进行采样
    sampled_counter = Counter()
    
    for cat_subcat, samples in samples_by_category.items():
        # 决定采样比例
        if cat_subcat in top5:
            # top5保留50%
            sample_ratio = 0.5
        elif cat_subcat in top10:
            # top5-top10保留70%
            sample_ratio = 0.7
        else:
            # 其他保留100%
            sample_ratio = 1.0
        
        # 计算需要保留的样本数量
        sample_count = int(len(samples) * sample_ratio)
        # 随机采样
        if sample_count < len(samples):
            sampled_data = random.sample(samples, sample_count)
        else:
            sampled_data = samples
        
        # 更新计数器
        sampled_counter[cat_subcat] = len(sampled_data)
        
        # 写入文件
        for data in sampled_data:
            write_to_file(data, output_file)
    
    # 打印采样结果
    print("\n=== 采样结果 ===")
    sampled_total = sum(sampled_counter.values())
    original_total = sum(category_subcategory_counter.values())
    
    for cat_subcat, count in category_subcategory_counter.most_common():
        original_count = category_subcategory_counter[cat_subcat]
        sampled_count = sampled_counter[cat_subcat]
        retention_rate = sampled_count / original_count * 100
        
        category_type = "Top5" if cat_subcat in top5 else "Top6-10" if cat_subcat in top10 else "其他"
        print(f"{cat_subcat} ({category_type}): {sampled_count}/{original_count} ({retention_rate:.1f}%)")
    
    # 打印总体保留率
    overall_retention = sampled_total / original_total * 100
    print(f"\n总体: {sampled_total}/{original_total} ({overall_retention:.1f}%)")

if __name__ == "__main__":
    main()