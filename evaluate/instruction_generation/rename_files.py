import os
import json
import shutil

# 2. 修改 train_new.jsonl 文件
jsonl_file = "train_new.jsonl"
jsonl_backup = "train_new.jsonl.backup"
jsonl_output = "train_new.jsonl.new"

# 备份原始文件
shutil.copy2(jsonl_file, jsonl_backup)
print(f"已备份原始文件: {jsonl_file} -> {jsonl_backup}")

# 逐行读取并替换内容
with open(jsonl_file, 'r', encoding='utf-8') as f_in, open(jsonl_output, 'w', encoding='utf-8') as f_out:
    for line in f_in:
        # 替换所有 "c174 为 "10_c174
        modified_line = line.replace('"c174', '"10_c174')
        modified_line = line.replace('/c174', '/10_c174')
        f_out.write(modified_line)

# 替换原文件
os.replace(jsonl_output, jsonl_file)
print(f"已完成 {jsonl_file} 中的替换工作")

print("全部操作已完成!") 