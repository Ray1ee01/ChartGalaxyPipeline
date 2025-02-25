import faiss
import numpy as np
from openai import OpenAI
import os
import json
import random
from sentence_transformers import SentenceTransformer

client = OpenAI(
    api_key="sk-jxsksswQmoRfTBjLF6E44dE151E9417c8f157f18AeC68283",
    base_url="https://aihubmix.com/v1"
)

class RagTitleGenerator:
    def __init__(self, 
                 index_path="faiss_infographics.index", # 如果已经创建好 FAISS 索引
                 data_path="infographics_data.npy", 
                 train_ratio=0.8, # 训练集、验证集比例
                 train_data_path=None, # 输入训练集路径
                 val_data_path=None, # 输入验证集路径
                 json_path=None
                ):
        # os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

        self.index_path = index_path
        self.data_path = data_path
        self.embed_model = SentenceTransformer("/data1/lizhen/all-MiniLM-L6-v2")
        self.training_data = [] # (input_text, headline, description)
        
        # 尝试加载已有的 FAISS 索引
        if os.path.exists(self.index_path) and os.path.exists(self.data_path):
            print("加载已有的 FAISS 索引")
            self.index = faiss.read_index(self.index_path)
            with open(self.data_path, "rb") as f:
                self.training_data = np.load(f, allow_pickle=True).tolist()
        else:
            print("创建新的 FAISS 索引")
            self.index = None

        self.train_data = [] # (img_path, details)
        self.val_data = [] # (img_path, details)
        self.train_ratio = train_ratio

        # 先把训练集、验证集构建出来
        self.train_data = None
        self.val_data = None
        if train_data_path and val_data_path:
            os.path.exists(train_data_path) and os.path.exists(val_data_path)
            with open(train_data_path, "r", encoding="utf-8") as f:
                train_json = json.load(f)
            with open(val_data_path, "r", encoding="utf-8") as f:
                val_json = json.load(f)

            self.train_data = list(train_json.items())
            self.val_data = list(val_json.items())
        elif json_path:
            train_set, val_set = self.split_json(json_path)
            self.train_data = train_set
            self.val_data = val_set

    def split_json(self, json_path):
        """按比例随机划分训练集和验证集，返回 list[(img_path, details)]"""
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        all_items = list(data.items())
        random.shuffle(all_items)

        split_idx = int(len(all_items) * self.train_ratio)
        train_set = all_items[:split_idx]
        val_set = all_items[split_idx:]
        return train_set, val_set

    def process_json(self):
        """用训练集构建 FAISS, 不会清除原本索引，所以调用前最好先调用 clear_faiss_data"""
        if not self.train_data:
            raise ValueError

        for img_path, details in self.train_data:
            data_text = "\n".join([
                ", ".join([f"{col}: {row[col]}" for col in details["columns"] if col in row])
                for row in details["data"]
            ])
            final_text = (
                f"Chart Type: {img_path.split('/')[1]}\n"
                f"Content: {details['content']}\n"
                f"Columns: {', '.join(details['columns'])}\n"
                f"Data:\n{data_text}"
            )

            headline = details.get("headline", "")
            description = details.get("description", "")
            self.add_training_data(final_text, headline, description)

    def add_training_data(self, input_text, headline, description):
        """将一个样本添加到训练数据列表和 FAISS 索引中"""
        self.training_data.append((input_text, headline, description))
        embedding = self.embed_model.encode([input_text])
        
        if self.index is None:
            dim = embedding.shape[1]
            self.index = faiss.IndexFlatL2(dim)
        
        self.index.add(np.array(embedding))
        
        # 保存 FAISS 索引和训练数据
        faiss.write_index(self.index, self.index_path)
        with open(self.data_path, "wb") as f:
            np.save(f, np.array(self.training_data, dtype=object))

    def retrieve_similar(self, new_input, top_k=1):
        """从训练数据构建的 FAISS 索引中检索相似样本"""
        if self.index is None or len(self.training_data) == 0:
            return []
        
        new_embedding = self.embed_model.encode([new_input])
        top_k = min(top_k, len(self.training_data))
        D, I = self.index.search(np.array(new_embedding), k=top_k)
        
        retrieved_list = []
        for idx in I[0]:
            data = self.training_data[idx][0]
            headline = self.training_data[idx][1]
            description = self.training_data[idx][2]
            retrieved_list.append((data, headline, description))

        return retrieved_list
    
    def generate_headline_description(self, sample_data, top_k=1):
        """
        sample_data 应该为 (image_path, details)
        通过 RAG 生成 headline 和 description
        """
        # 检查输入格式
        if isinstance(sample_data, tuple) and len(sample_data) == 2 and isinstance(sample_data[1], dict):
            new_input_dict = sample_data[1]
        else:
            raise ValueError("Invalid input format. Expected a tuple of (image_path, dict)")

        retrieved_examples = self.retrieve_similar(new_input_dict["content"], top_k=top_k)
        
        data_text = "\n".join([
            ", ".join([f"{col}: {row[col]}" for col in new_input_dict["columns"] if col in row])
            for row in new_input_dict["data"]
        ])

        context = ""
        if retrieved_examples:
            context += "Here are some similar examples:\n"
            for i, (r_data, rh, rd) in enumerate(retrieved_examples, start=1):
                context += (
                    f"\n[Similar Example {i}]\n"
                    f"Input Data:\n{r_data}\n"
                    f"Headline: {rh}\n"
                    f"Description: {rd}\n"
                )
            context += "\nBased on the above examples, please generate a new headline and description for the following data. "
        else:
            context += "No similar examples found.\n\nPlease generate a new headline and description for the following data. "

        context += (
            f"\nChart Type: {new_input_dict.get('chart_type', 'Unknown')}\n"
            f"Content: {new_input_dict['content']}\n"
            f"Columns: {', '.join(new_input_dict['columns'])}\n"
            f"Data:\n{data_text}\n\n"
            "Please output your result as a valid JSON object with two keys: 'headline' and 'description'. Like:\n"
            "{\n"
            '    "headline": "blabla",\n'
            '    "description": "blabla"\n'
            "}"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", 
                 "content": "You are an AI assistant that generates infographic headlines and descriptions based on provided data."},
                {"role": "user", "content": context}
            ]
        )

        generated_text = response.choices[0].message.content
        try:
            output = json.loads(generated_text)
            generated_headline = output.get("headline", "")
            generated_description = output.get("description", "")
        except Exception:
            parts = generated_text.split("\n", 1)
            generated_headline = parts[0] if parts else ""
            generated_description = parts[1].strip() if len(parts) > 1 else ""

        return generated_headline, generated_description

    def clear_faiss_data(self):
        """清除 FAISS 索引和数据文件"""
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.data_path):
            os.remove(self.data_path)
        self.index = None
        self.training_data = []

if __name__ == "__main__":
    import time
    time1 = time.time()
    RTG = RagTitleGenerator(train_data_path="/home/lizhen/ChartPipeline/src/processors/data_enricher_modules/train_content.json",\
                            val_data_path="/home/lizhen/ChartPipeline/src/processors/data_enricher_modules/val_output.json")
    print("Init time:", time.time() - time1)
    
    RTG.clear_faiss_data()
    RTG.process_json()
    print("Process JSON time:", time.time() - time1)
    
    output_file = "results.txt"
    with open(output_file, "a", encoding="utf-8") as f:
        f.write(f"RAG, ratio=0.99, topk=3\n")
        f.write("=" * 80 + "\n\n")
        for sample_input in RTG.val_data[:min(20, len(RTG.val_data))]:
            result = RTG.generate_headline_description(sample_input, top_k=3)

            f.write(f"Generated Headline: {result[0]}\n")
            f.write(f"Ground Truth Headline: {sample_input[1].get('headline', '')}\n")
            f.write(f"Generated Description: {result[1]}\n")
            f.write(f"Ground Truth Description: {sample_input[1].get('description', '')}\n")
            f.write("=" * 80 + "\n\n")

    print("Total time:", time.time() - time1)