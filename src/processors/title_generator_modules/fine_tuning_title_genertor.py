import os
import json
import random
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    Trainer,
    TrainingArguments,
    DataCollatorForSeq2Seq
)
from torch.utils.data import Dataset
import re


class HeadlineDataset(Dataset):
    """格式转换，将每个样本转换为模型输入格式"""
    def __init__(self, data, tokenizer, max_input_length=512, max_target_length=128):
        self.data = data
        self.tokenizer = tokenizer
        self.max_input_length = max_input_length
        self.max_target_length = max_target_length

    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        input_text = item["input_text"]
        target_text = item["target_text"]
        model_inputs = self.tokenizer(
            input_text, max_length=self.max_input_length, truncation=True, padding="max_length"
        )
        labels = self.tokenizer(
            target_text, max_length=self.max_target_length, truncation=True, padding="max_length"
        )
        labels_ids = [token_id if token_id != self.tokenizer.pad_token_id else -100 
                      for token_id in labels.input_ids]
        model_inputs["labels"] = labels_ids
        return model_inputs


class FineTuneHeadlineGenerator:
    def __init__(self, 
                 model_name_or_path="t5-base",
                 finetuned_dir=None,
                 train_ratio=0.8,
                 train_data_path=None,
                 val_data_path=None,
                 json_path=None
                 ):
        self.finetuned_dir = finetuned_dir
        if finetuned_dir and os.path.exists(finetuned_dir):
            print(f"加载已微调模型：{finetuned_dir}")
            self.tokenizer = AutoTokenizer.from_pretrained(finetuned_dir)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(finetuned_dir)
        else:
            print("加载未微调模型：", model_name_or_path)
            self.tokenizer = AutoTokenizer.from_pretrained(model_name_or_path)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name_or_path)

        self.train_ratio = train_ratio
        self.train_data = []
        self.val_data = []

        if train_data_path and val_data_path \
           and os.path.exists(train_data_path) \
           and os.path.exists(val_data_path):
            with open(train_data_path, "r", encoding="utf-8") as f:
                train_json = json.load(f)
            with open(val_data_path, "r", encoding="utf-8") as f:
                val_json = json.load(f)
            self.train_data = list(train_json.items())
            self.val_data = list(val_json.items())
            self.json_path = None
        elif json_path and os.path.exists(json_path):
            self.json_path = json_path
            self._split_json()
        else:
            self.json_path = None

    def _split_json(self):
        """
        按照 self.train_ratio 对 json_path 中的数据做随机拆分
        仅在 __init__ 中使用
        """
        with open(self.json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        all_items = list(data.items())  # [(key, value)]
        random.shuffle(all_items)
        split_idx = int(len(all_items) * self.train_ratio)
        self.train_data = all_items[:split_idx]
        self.val_data = all_items[split_idx:]

    def process_json(self):
        """对训练集格式转换"""
        if not self.train_data:
            raise ValueError("train_data 为空，无法处理。")

        processed_data = []
        for img_path, details in self.train_data:
            chart_type = img_path.split('/')[1] if len(img_path.split('/')) > 1 else "Unknown"

            # 拼接 data_text
            data_text = "\n".join([
                ", ".join([f"{col}: {row[col]}" for col in details["columns"] if col in row])
                for row in details["data"]
            ])

            input_text = (
                "Please generate infographic headlines and descriptions based on provided data.\n"
                f"Chart Type: {chart_type}\n"
                f"Content: {details['content']}\n"
                f"Columns: {', '.join(details['columns'])}\n"
                f"Data:\n{data_text}\n\n"
            )

            # 目标文本——模型要输出的正确 JSON
            headline = details.get("headline", "")
            description = details.get("description", "")
            target_text = json.dumps({
                "headline": headline,
                "description": description
            }, ensure_ascii=False)

            processed_data.append({
                "input_text": input_text,
                "target_text": target_text,
                "meta": {
                    "chart_type": chart_type,
                    "content": details["content"],
                    "columns": details["columns"],
                    "data": details["data"]
                }
            })

        return processed_data

    def train(self, training_data, output_dir="./finetuned_headline_model", epochs=3, batch_size=4):
        """使用传入的训练数据进行微调"""
        dataset = HeadlineDataset(training_data, self.tokenizer)
        data_collator = DataCollatorForSeq2Seq(self.tokenizer, model=self.model)
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            save_steps=500,
            save_total_limit=2,
            logging_steps=100,
            evaluation_strategy="no",
            fp16=True,
            learning_rate=5e-5,
            weight_decay=0.01
        )
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator
        )
        trainer.train()
        # 保存微调后的 model & tokenizer
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)
        return output_dir

    def generate_headline_description(self, sample_data, max_length=128):
        """生成 headline & description"""
        if (not isinstance(sample_data, tuple)
                or len(sample_data) != 2
                or not isinstance(sample_data[1], dict)):
            raise ValueError

        image_path, details = sample_data
        chart_type = image_path.split('/')[1] if len(image_path.split('/')) > 1 else "Unknown"

        data_text = "\n".join([
            ", ".join([f"{col}: {row[col]}" for col in details["columns"] if col in row])
            for row in details["data"]
        ])

        # 优化 Prompt
        context = (
            "Please generate infographic headlines and descriptions based on the provided data.\n"
            f"Chart Type: {chart_type}\n"
            f"Content: {details['content']}\n"
            f"Columns: {', '.join(details['columns'])}\n"
            f"Data:\n{data_text}\n\n"
            "IMPORTANT: Your response MUST be a valid JSON object. Do NOT add extra text or explanation. "
            "ONLY return a JSON object with the following format:\n"
            "{\n"
            '  "headline": "Generated headline text",\n'
            '  "description": "Generated description text"\n'
            "}\n"
            "⚠️ USE ONLY STANDARD DOUBLE QUOTES (\") FOR JSON KEYS AND VALUES. DO NOT USE FULL-WIDTH QUOTES (“”)."
        )

        inputs = self.tokenizer.encode(context, return_tensors="pt", truncation=True)
        device = next(self.model.parameters()).device
        inputs = inputs.to(device)

        outputs = self.model.generate(
            inputs,
            max_length=max_length,
            num_beams=4,
            early_stopping=True,
            no_repeat_ngram_size=2,
            forced_bos_token_id=self.tokenizer.convert_tokens_to_ids("{")  # 强制 JSON 以 { 开头
        )
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        output = self.fix_json_output(generated_text)

        if output:
            headline = output.get("headline", "Untitled")
            description = output.get("description", "No description available.")
        else:
            headline = generated_text.strip()
            description = ""

        return (headline, description)
    
    def fix_json_output(self, text):
        """尝试修正 JSON 输出"""
        text = text.strip()

        text = text.replace("“", "\"").replace("”", "\"")

        if not text.startswith("{"):
            text = "{" + text
        if not text.endswith("}"):
            text = text + "}"

        text = re.sub(r'(\w+):', r'"\1":', text)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None
        
if __name__ == "__main__":
    finetuned_dir = "/data1/lizhen/fined_headline_model"

    FHG = FineTuneHeadlineGenerator(
        model_name_or_path="/data1/lizhen/t5-base",
        finetuned_dir=finetuned_dir,
        train_ratio=0.9,         # 9:1 拆分
        train_data_path="/home/lizhen/ChartPipeline/src/processors/data_enricher_modules/train_content.json",
        val_data_path="/home/lizhen/ChartPipeline/src/processors/data_enricher_modules/val_output.json",
        json_path=None
    )
    
    train_set = FHG.process_json()
    print(f"训练集样本数: {len(train_set)}，验证集样本数: {len(FHG.val_data)}")

    output_dir = FHG.train(train_set, output_dir=finetuned_dir, epochs=3, batch_size=2)
    
    output_file = "results.txt"
    with open(output_file, "a", encoding="utf-8") as f:
        f.write(f"Fine Tuning T5-base, ratio=0.99 \n")
        f.write("=" * 80 + "\n\n")
        for sample_input in FHG.val_data[:min(20, len(FHG.val_data))]:
            result = FHG.generate_headline_description(sample_input)

            f.write(f"Generated Headline: {result[0]}\n")
            f.write(f"Ground Truth Headline: {sample_input[1].get('headline', '')}\n")
            f.write(f"Generated Description: {result[1]}\n")
            f.write(f"Ground Truth Description: {sample_input[1].get('description', '')}\n")
            f.write("=" * 80 + "\n\n")