import faiss
import numpy as np
from openai import OpenAI
import os
import json
import random
from tqdm import tqdm

from sentence_transformers import SentenceTransformer
from nltk.translate.bleu_score import corpus_bleu

client = OpenAI(
    api_key="sk-7TndhZHnyzdeSVpL4755335348B4425cB64bF8Ea80379073",
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
        self.training_data = [] # (input_text, title, description)
        
        # 尝试加载已有的 FAISS 索引
        if os.path.exists(self.index_path) and os.path.exists(self.data_path):
            print("加载已有的 FAISS 索引")
            self.index = faiss.read_index(self.index_path)
            with open(self.data_path, "rb") as f:
                self.training_data = np.load(f, allow_pickle=True).tolist()
        else:
            print("创建新的 FAISS 索引")
            self.index = None

        self.train_data = [] # (name, details)
        self.val_data = [] # (name, details)
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
        """按比例随机划分训练集和验证集，返回 list[(name, details)]"""
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
        
        for name, details in tqdm(self.train_data, desc="正在创建新的 FAISS 索引"):
            final_text = self.process_single_data((name, details), need_content=True, need_main_insight=True)

            title = details.get("title", "")
            description = details.get("description", "")
            self.add_training_data(final_text, title, description)

    def process_single_data(self, data, need_content=True, need_main_insight = True):
        """将单条数据从 json 格式转换为 str"""
        details = data[1]

        data_text = "\n".join([
            ", ".join([f"{col['name']}: {row[col['name']]}" for col in details["columns"] if col["name"] in row])
            for row in details["data"]
        ])

        # contenn_text = f"Content: {details['content']}\n" if need_content else ""
        contenn_text = ""
        if need_content:
            contenn_text = f"Data Facts: {details['data_facts']}\n"
            # returned_data_facts = self.get_data_facts_by_LLM(details)

            # if isinstance(returned_data_facts, str): # json 解析失败
            #     contenn_text = f"Data Facts: {returned_data_facts}\n" # TODO: 这里叫 Content 比较好还是叫 Data Facts 比较好？
            # elif isinstance(returned_data_facts, list):
            #     contenn_text = "Data Facts:\n"
            #     for idx, data_fact in enumerate(returned_data_facts, start=1):
            #         contenn_text += f"{idx}. {data_fact}\n"
                    
        main_insight_text = f"Main Insight: {details['main_insight']}\n" if need_main_insight else ""

        final_text = (
            f"Chart Type: {details['chart_type']}\n" + 
            contenn_text + 
            main_insight_text +
            f"Columns: {', '.join(col['name'] for col in details['columns'])}\n"
            f"Data:\n{data_text}"
        )
        return final_text


    def add_training_data(self, input_text, title, description):
        """将一个样本添加到训练数据列表和 FAISS 索引中"""
        self.training_data.append((input_text, title, description))
        embedding = self.embed_model.encode([input_text])
        
        if self.index is None:
            dim = embedding.shape[1]
            self.index = faiss.IndexFlatL2(dim)
        
        self.index.add(np.array(embedding))
        
        # 保存 FAISS 索引和训练数据
        faiss.write_index(self.index, self.index_path)
        with open(self.data_path, "wb") as f:
            np.save(f, np.array(self.training_data, dtype=object))

    def retrieve_similar(self, new_input, topk=1):
        """从训练数据构建的 FAISS 索引中检索相似样本"""
        if self.index is None or len(self.training_data) == 0:
            return []
        
        new_embedding = self.embed_model.encode([new_input])
        topk = min(topk, len(self.training_data))
        D, I = self.index.search(np.array(new_embedding), k=topk)
        
        retrieved_list = []
        for idx in I[0]:
            data = self.training_data[idx][0]
            title = self.training_data[idx][1]
            description = self.training_data[idx][2]
            retrieved_list.append((data, title, description))

        return retrieved_list
    
    def generate_title_description(self, sample_data, topk: int=1):
        """
        sample_data 应该为 (image_path, details)
        通过 RAG 生成 title 和 description
        """
        # 检查输入格式
        if not (isinstance(sample_data, tuple) and len(sample_data) == 2 and isinstance(sample_data[0], str)\
            and isinstance(sample_data[1], dict)):
            raise ValueError

        retrieve_text = self.process_single_data(sample_data, need_content=True, need_main_insight=False) # 查找时不能使用 content

        if topk > 0:
            retrieved_examples = self.retrieve_similar(retrieve_text, topk=topk)
        else:
            retrieved_examples = ""

        # 限制输出长度
        max_words = 30
        for i, (r_data, rh, rd) in enumerate(retrieved_examples, start=1):
            if rh is None:
                rh = ""
            if rd is None:
                rd = ""
            example_text = (rh + " " + rd).strip()
            words_count = len(example_text.split()) + 5
            if words_count > max_words:
                max_words = words_count

        context = ""
        if retrieved_examples:
            context += "Here are some similar examples:\n"
            for i, (r_data, rh, rd) in enumerate(retrieved_examples, start=1):
                context += (
                    f"\n[Similar Example {i}]\n"
                    f"Input Data:\n{r_data}\n"
                    f"title: {rh}\n"
                    f"Description: {rd}\n"
                )
            context += "\nBased on the above examples, please generate a new title and description for the following data. \n"
        else:
            context += "No similar examples found.\n\nPlease generate a new title and description for the following data.\n"

        context += (
            retrieve_text + '\n\n'
            "Important instructions:\n"
            "1. Use exact terminology from the data sources.\n"
            "2. Do NOT use these verbs: show, reveal, illustrate, analyze.\n"
            "3. Avoid subjective statements (e.g., 'An analysis of...'). Focus on main metrics: Share, Rate, Number, Percentage.\n"
            f"4. The total length of your final title + description must NOT exceed {max_words} words.\n\n"
            "Please output your result as a valid JSON object with two keys: 'title' and 'description'. Like:\n"
            "{\n"
            '    "title": "some title",\n'
            '    "description": "some description"\n'
            "}"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", 
                 "content": "You are an AI assistant that generates infographic titles and descriptions based on provided data."},
                {"role": "user", "content": context}
            ]
        )

        generated_text = response.choices[0].message.content
        try:
            output = json.loads(generated_text)
            generated_title = output.get("title", "")
            generated_description = output.get("description", "")
        except Exception:
            parts = generated_text.split("\n", 1)
            generated_title = parts[0] if parts else ""
            generated_description = parts[1].strip() if len(parts) > 1 else ""

        return generated_title, generated_description

    def clear_faiss_data(self):
        """清除 FAISS 索引和数据文件"""
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.data_path):
            os.remove(self.data_path)
        self.index = None
        self.training_data = []
        print("已清除原 FAISS 索引")

    def evaluate_bleu(self):
        """RAG Ablation"""
        if not self.val_data:
            print("evaluate 失败，因为无验证集")
            return
        
        references = []
        predictions_rag = []

        for sample_input in self.val_data:
            # Ground Truth
            gt_title = sample_input[1].get("title", "")
            gt_description = sample_input[1].get("description", "")
            if not gt_title:
                gt_title = ""
            if not gt_description:
                gt_description = ""
            reference_text = ("title: " + gt_title + "\n" + "description: " + gt_description).strip()

            references.append([reference_text.split()])

        for topk in range(10):
            predictions_rag.append([])
            for sample_input in tqdm(self.val_data, desc=f"正在生成 topk={topk} 回答."):
                # RAG ablation topk
                rag_title, rag_desc = self.generate_title_description(sample_input, topk=topk)
                pred_rag_text = ("title: " + rag_title + "\n" +  "description: " + rag_desc).strip()

                predictions_rag[-1].append(pred_rag_text.split())

            bleu_rag = corpus_bleu(references, predictions_rag[-1], weights=(0.25, 0.25, 0.25, 0.25))
            print(f"[Evaluation] RAG (topk={topk}) BLEU-4: {bleu_rag:.4f}")
            with open("/home/lizhen/ChartPipeline/src/processors/title_generator_modules/ablation.txt", "a", encoding="utf-8") as file:
                file.write(f"[Evaluation] RAG (topk={topk}) BLEU-4: {bleu_rag:.4f}\n")

        return bleu_rag

    def generate_json_with_data_facts(self, json_path, mode, output_path="./data_with_data_facts.json", temp_path="./temp_data_facts.json"):
        """
        先生成包含 data facts 的 json, 避免每次训练重新生成 data facts
        mode 应当是一个 str, 从 "LLM" 和 "rules" 中二选一
        """
        if mode not in ["LLM", "rules"]:
            raise ValueError
        
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        updated_data = {}
        for key, details in tqdm(data.items(), desc="正在生成包含 data facts 的 json"):
            text = self.process_single_data((key, details), need_content=False, need_main_insight=True)

            if mode == "LLM":
                data_facts = self.get_data_facts_by_LLM(text)
            elif mode == "rules":
                data_facts = self.get_data_facts_by_rules(text)

            details["data_facts"] = data_facts
            updated_data[key] = details

            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(updated_data, f, ensure_ascii=False, indent=4)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=4)

        print(f"增加了 data facts 的 json 已保存到: {output_path}")
        return output_path

    def get_data_facts_by_LLM(self, input_text):
        """通过大模型获取 data facts, 输入一个处理好的 str"""
        # AutoTitle: An Interactive Title Generator for Visualizations

        prompt = (
            "You are a data analysis assistant, capable of identifying the following types of data facts:\n"
            "\n"
            "1) Aggregate: aggregate operation computes the aggregation for a list of value-type "
            "facts with only one different attribute. Common types of "
            "aggregation include maximum, minimum, average, and summation.\n"
            " - Structure: <obj, aggregate_type, [range], value>\n"
            " - Example: aggregate<population, maximum, 2000-2010, 1.4 billion>\n"
            "\n"
            "2) Compare: compare operation is a computation operation of two counterparts "
            "of data facts. Two data facts should have the same measure "
            "but with different categorical attributes or different temporal "
            "ranges. The sign of the comparison is larger, smaller, and "
            "similar. The degree of comparison is expressed in various ways, "
            "including ratios, percentages of differences, times, and different amounts.\n"
            " - Structure: <ref1, ref2, sign, [degree]>\n"
            " - Example: compare<Country A, Country B, larger, by 20%>\n"
            "\n"
            "3) Trend: trend operation takes a list of facts with continuous temporal "
            "attributes as input. A trend fact has a trend type and degree. "
            "The trend type can be \"increase\", \"decrease\", or \"stay stable\". "
            "The degree of the trend is described using adverbs (e.g., quickly, "
            "slowly, significantly), percentages (e.g., by 15%), multiples (by "
            "3-folds), and change values (by 20 dollars). Note that only data with "
            "temporal characteristics can describe trends.\n"
            " - Structure: <ref, range, trend_type, [degree]>\n"
            " - Example: trend<Stock Price, 2020-2021, increase, by 15%>\n"
            "\n"
            "4) Merge: merge accepts a list of facts with different reference names and "
            "the same content, which produces a new fact by merging the "
            "reference name. For example, the merging result of \"China\'s "
            "population increased\" and \"India\'s population increased\" is "
            "\"China and India\'s population increased.\"\n"
            " - Structure: <merged_obj, content>\n"
            " - Example: merge<China and India, population increased>\n"
            "\n"
            "5) Combination: combination operation accepts a list of facts with different "
            "contents and ranges. Combining two or more trends with the same"
            "reference name and different ranges can produce a complex-trend fact. "
            "For example, the fact about stock price increasing first and then "
            "decreasing is the output of combining two simple facts.\n"
            " - Structure: <ref, [content1, content2]>\n"
            " - Example: combine<Stock Price, [increased from 2020 to 2021, decreased from 2021 to 2022]>\n"
            "\n"
            "6) Overview: overview accepts all atomic facts as input and generates the "
            "general facts corresponding to generic titles. General facts only "
            "involve overall information, e.g., attribute names and feature type\n"
            " - Structure: <attribute_name, [feature_type], [range]>\n"
            " - Example: overview<columns, [categorical and numerical], [2010-2020]>\n"

            "Given the following sample chart data, Please identify no more than five of the most dominant data facts "
            "in the dataset. Describe each data fact using the n-tuple format above without changing the number of "
            "elements in the tuple. The meaning each element should strictly adhere to the specified definition. "
            "The data facts you find should be ranked in order of importance. "
            # "Please review the chart data below and identify no more than five of the most significant data facts, "
            # "ranking them in order of importance. The n-tuple format above specifies the elements you need "
            # "to include, but your response does not need to strictly follow the tuple. Instead, "
            # "describe each data fact in natural language while ensuring that your description "
            # "includes each element from the n-tuple. "
            "If no facts are found, output an empty JSON array. Otherwise, output a JSON array of strings, "
            "with each string representing one fact. For example:\n"
            "[\n"
            "\"compare<CountryA, CountryB, larger, 2 times>\",\n"
            "\"trend<Sales, 2022, decrease, by 10%>\"\n"
            # "\"Country A is 20\% higher compared to Country B.\",\n"
            # "\"The sales showed a downward trend between 2010 and 2022, decreasing by 10%.\"\n"
            "]\n"
            "\n"
            "Sample data:\n"
            f"{input_text}\n"
            "\n"
            "Please respond with a JSON array of data facts in the specified format. Note: DO NOT add ```json at the "
            "beginning of your output or ``` at the end. Follow the format of the example above!"
            # "Please respond with a JSON array of data facts in natual language. Note: DO NOT add ```json at the "
            # "beginning of your output or ``` at the end. Follow the format of the example above!"
        )
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", 
                "content": "You are an AI assistant that identifies data facts from chart information."},
                {"role": "user", "content": prompt}
            ]
        )

        generated_text = ""
        if response.choices[0].message.content is None:
            print("response.choices[0].message.content is None!")
        else:
            generated_text = response.choices[0].message.content.strip()

        final_data_facts = generated_text # 如果解析失败，直接返回原来格式
        try:
            data_facts = json.loads(generated_text)
            if isinstance(data_facts, list):
                final_data_facts = data_facts
            else:
                print("The model output is not a JSON array:", generated_text)
        except Exception as e:
            print("Failed to parse the model's output as JSON:", e)
            print("Raw output:", generated_text)

        return final_data_facts

        """
        TODO: 几个麻烦的点
        1. LLM 返回的有格式的 data facts 能不能直接作为 content? 感觉肯定是不行的
            或许可以让 LLM 直接用自然语言描述 data facts? 毕竟现在的格式也没什么实际意义
        2. 通过规则寻找 data facts 仍然比较困难，第一个问题是格式上，第二个问题是 data facts还有待扩充
        3. 现在新格式的数据还有待处理
            或许这个可以先做 XXX
                首先需要合并出来一个 content.json
        4. 不确定验证集是否能使用 data facts 之类的信息？
            不确定 columns 里 importance, description 能不能用，暂时不用

        TODO:
        做下面几个：用自然语言的 LLM, 规则形式的 LLM, 规则形式的 rule-based, 对比
        用不用 main insight 的对比

        总共 4 个
        """
        
        
    def get_data_facts_by_rules(self):
        """通过规则获取 data facts"""
        pass

if __name__ == "__main__":
    import time
    time1 = time.time()
    # RTG = RagTitleGenerator(train_data_path="/home/lizhen/ChartPipeline/src/processors/title_generator_modules/train_content.json",\
    #                         val_data_path="/home/lizhen/ChartPipeline/src/processors/title_generator_modules/val_output.json")
    RTG = RagTitleGenerator(json_path="/home/lizhen/ChartPipeline/src/processors/title_generator_modules/data_with_data_facts.json",
                            train_ratio=0.9)
    print("Init time:", time.time() - time1)
    
    RTG.clear_faiss_data()
    RTG.process_json()
    print("Process JSON time:", time.time() - time1)
    
    # output_file = "results.txt"
    # with open(output_file, "a", encoding="utf-8") as f:
        # f.write(f"RAG, ratio=0.99, topk=3\n")
        # f.write("=" * 80 + "\n\n")
        # for sample_input in RTG.val_data[:min(20, len(RTG.val_data))]:
        #     result = RTG.generate_title_description(sample_input, topk=3)

        #     f.write(f"Generated title: {result[0]}\n")
        #     f.write(f"Ground Truth title: {sample_input[1].get('title', '')}\n")
        #     f.write(f"Generated Description: {result[1]}\n")
        #     f.write(f"Ground Truth Description: {sample_input[1].get('description', '')}\n")
            # f.write("=" * 80 + "\n\n")


    # for sample_input in RTG.val_data[:min(3, len(RTG.val_data))]:
    #     result = RTG.generate_title_description(sample_input, topk=3)

    #     print(f"Generated title: {result[0]}\n")
    #     print(f"Ground Truth title: {sample_input[1].get('title', '')}\n")
    #     print(f"Generated Description: {result[1]}\n")
    #     print(f"Ground Truth Description: {sample_input[1].get('description', '')}\n")

    RTG.evaluate_bleu()

    # for sample_input in RTG.val_data[:min(3, len(RTG.val_data))]:
    #     result = RTG.get_data_facts_by_LLM(sample_input)
    #     print(result)

    print("Total time:", time.time() - time1)