import os
import json
import random
import time
import faiss
import numpy as np
from tqdm import tqdm

from typing import Any, Dict, List, Optional, Tuple, Union

from openai import OpenAI
from sentence_transformers import SentenceTransformer
from nltk.translate.bleu_score import corpus_bleu
from bert_score import score

client = OpenAI(
    api_key="sk-7TndhZHnyzdeSVpL4755335348B4425cB64bF8Ea80379073",
    base_url="https://aihubmix.com/v1"
)

class RagTitleGenerator:
    def __init__(
        self,
        index_path: str = "faiss_infographics.index",
        data_path: str = "infographics_data.npy",
        train_ratio: float = 0.8,
        train_data_path: Optional[str] = None,
        val_data_path: Optional[str] = None,
        json_path: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> None:
        """
        Args:
            index_path (str, optional): The file path where FAISS index is stored (or will be stored).
            data_path (str, optional): The file path where training data embeddings are stored.
            train_ratio (float, optional): The ratio for splitting training/validation sets if only one JSON is given.
            train_data_path (str, optional): Path to a JSON file used as the training set.
            val_data_path (str, optional): Path to a JSON file used as the validation set.
            json_path (str, optional): Path to a single JSON file from which training/validation sets will be split.
            metadata (dict, optional): A dictionary mapping the JSON keys to user-defined keys, e.g.:
                {
                    "title": "title_key_in_your_json",
                    "description": "description_key_in_your_json",
                    "columns": "columns_key_in_your_json",
                    "data": "data_key_in_your_json",
                    "data_facts": "data_facts_key_in_your_json",
                    "main_insight": "main_insight_key_in_your_json",
                    "chart_type": "chart_type_key_in_your_json",
                    "column_sub_name": "column_sub_name"
                }
                If not provided, defaults (e.g., "title") will be used.
        """
        self.index_path = index_path
        self.data_path = data_path
        self.embed_model = SentenceTransformer("/data1/lizhen/all-MiniLM-L6-v2")
        self.training_data = []  # (input_text, title, description)

        self.metadata = metadata if metadata else {}
        self.key_title = self.metadata.get("title", "title")
        self.key_description = self.metadata.get("description", "description")
        self.key_columns = self.metadata.get("columns", "columns")
        self.key_data = self.metadata.get("data", "data")
        self.key_data_facts = self.metadata.get("data_facts", "data_facts")
        self.key_main_insight = self.metadata.get("main_insight", "main_insight")
        self.key_chart_type = self.metadata.get("chart_type", "chart_type")
        self.key_column_sub_name = self.metadata.get("column_sub_name", "name")

        # Try to load existing FAISS index
        if os.path.exists(self.index_path) and os.path.exists(self.data_path):
            print("Load existing FAISS index")
            self.index = faiss.read_index(self.index_path)
            with open(self.data_path, "rb") as f:
                self.training_data = np.load(f, allow_pickle=True).tolist()
        else:
            print("Build new FAISS index")
            self.index = None

        self.train_data = []
        self.val_data = []
        self.train_ratio = train_ratio

        # Build train/val
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

    def split_json(
        self,
        json_path: str
    ) -> Tuple[List[Tuple[str, Dict[str, Any]]], List[Tuple[str, Dict[str, Any]]]]:
        """Split a single JSON file into training and validation sets by self.train_ratio.

        Args:
            json_path (str): Path to the JSON file.

        Returns:
            tuple: Two lists of (key, details) pairs: (train_set, val_set).
        """
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        all_items = list(data.items())
        random.shuffle(all_items)

        split_idx = int(len(all_items) * self.train_ratio)
        train_set = all_items[:split_idx]
        val_set = all_items[split_idx:]

        return train_set, val_set

    def process_json(self) -> None:
        """Process the training JSON to build a FAISS index (if not already built).

        Raises:
            ValueError: If there is no training data (`self.train_data` is empty).
        """
        if not self.train_data:
            raise ValueError("Can not build index because the valid set is empty.")

        for name, details in tqdm(self.train_data, desc="Building new FAISS index"):
            final_text = self.process_single_data((name, details), need_content=True, need_main_insight=True)

            title = details.get(self.key_title, "")
            description = details.get(self.key_description, "")
            self.add_training_data(final_text, title, description)

    def process_single_data(
        self,
        data: Tuple[str, Dict[str, Any]],
        need_content: bool = True,
        need_main_insight: bool = True
    ) -> str:
        """Convert a single JSON entry into a string for retrieval and prompting.

        Args:
            data (tuple): A tuple (id_key, details_dict).
            need_content (bool, optional): Whether to include "data_facts" in the string.
            need_main_insight (bool, optional): Whether to include "main_insight" in the string.

        Returns:
            str: A combined textual representation of the JSON data.
        """
        details = data[1]

        columns_info = details.get(self.key_columns, [])
        chart_data = details.get(self.key_data, [])
        data_facts = details.get(self.key_data_facts, [])
        main_insight = details.get(self.key_main_insight, "")
        chart_type = details.get(self.key_chart_type, "")

        # TODO: If columns is a list of strings, just use them directly;
        # if it's a list of dict with "name" in each, you can adapt as needed.
        # Here we assume it's a list of strings for simplicity:
        if self.key_column_sub_name:
            data_text = "\n".join([
                ", ".join(
                    f"{col[self.key_column_sub_name]}: {row.get(col[self.key_column_sub_name], '')}" 
                    for col in columns_info
                )
                for row in chart_data
            ])
        else:
            data_text = "\n".join([
                ", ".join(
                    f"{col}: {row.get(col, '')}" 
                    for col in columns_info
                )
                for row in chart_data
            ])

        content_text = f"Data Facts: {data_facts}\n" if need_content and data_facts else ""
        main_insight_text = f"Main Insight: {main_insight}\n" if need_main_insight and main_insight else ""
        chart_type_text = f"Chart Type: {chart_type}\n" if chart_type else ""
        if self.key_column_sub_name:
            column_text = f"Columns: {', '.join(col[self.key_column_sub_name] for col in columns_info)}\n"
        else:
            column_text = f"Columns: {', '.join(col for col in columns_info)}\n"

        final_text = (
            f"{chart_type_text}"
            f"{content_text}"
            f"{main_insight_text}"
            f"{column_text}"
            f"Data:\n{data_text}"
        )
        return final_text

    def add_training_data(
        self,
        input_text: str,
        title: str,
        description: str
    ) -> None:
        """Add a single sample to training data and FAISS index.

        Args:
            input_text (str): Concatenated text derived from JSON details.
            title (str): Ground truth or known title.
            description (str): Ground truth or known description.
        """
        self.training_data.append((input_text, title, description))
        embedding = self.embed_model.encode([input_text])

        if self.index is None:
            dim = embedding.shape[1]
            self.index = faiss.IndexFlatL2(dim)

        self.index.add(np.array(embedding))

        # Persist to disk
        faiss.write_index(self.index, self.index_path)
        with open(self.data_path, "wb") as f:
            np.save(f, np.array(self.training_data, dtype=object))

    def retrieve_similar(
        self,
        new_input: str,
        topk: int = 1
    ) -> List[Tuple[str, str, str]]:
        """Retrieve the most similar training samples from FAISS index.

        Args:
            new_input (str): The query text to encode and search for.
            topk (int, optional): Number of similar samples to retrieve.

        Returns:
            list: A list of tuples (input_text, title, description) from the training data.
        """
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

    def generate_title_description(
        self,
        sample_data: Tuple[str, Dict[str, Any]],
        topk: int = 1
    ) -> Tuple[str, str]:
        """Generate a title and description via RAG approach, with an optional nearest-neighbor search.

        Args:
            sample_data (tuple): A tuple (id_key, details_dict) from the JSON.
            topk (int, optional): Number of similar examples to retrieve for prompting.

        Raises:
            ValueError: If `sample_data` format is incorrect.

        Returns:
            tuple: (generated_title, generated_description)
        """
        if not (
            isinstance(sample_data, tuple) 
            and len(sample_data) == 2 
            and isinstance(sample_data[0], str)
            and isinstance(sample_data[1], dict)
        ):
            raise ValueError("Wrong sample_data format, should be (name:str, details:dict)")

        retrieved_text = self.process_single_data(sample_data, need_content=True, need_main_insight=True)

        if topk > 0:
            retrieved_examples = self.retrieve_similar(retrieved_text, topk=topk)
        else:
            retrieved_examples = []

        # Compute word-length constraints based on retrieved examples
        max_title_words = 8
        max_description_words = 13
        for i, (r_data, rt, rd) in enumerate(retrieved_examples, start=1):
            rt = rt if rt else ""
            rd = rd if rd else ""
            max_title_words = max(max_title_words, len(rt.split()))
            max_description_words = max(max_description_words, len(rd.split()))

        # Build example text for the prompt
        example_text = ""
        if retrieved_examples:
            example_text += "Here are some similar examples:\n"
            for i, (r_data, rt, rd) in enumerate(retrieved_examples, start=1):
                rt = rt if rt else ""
                rd = rd if rd else ""
                example_text += (
                    f"\n[Similar Example {i}]\n"
                    f"Input Data:\n{r_data}\n"
                    f"Title: {rt}\n"
                    f"Description: {rd}\n"
                )

        title_prompt = (
            f"{example_text}\n"
            "Based on the above examples (if any), please generate a clear and concise TITLE for the following data.\n"
            f"{retrieved_text}\n\n"
            "Important instructions:\n"
            "1. The title should focus on the most significant feature of the data. "
            "You can choose one or more key insights from the Data Facts that best "
            "illustrate the issue, or you can identify the most notable feature in the data yourself.\n"
            f"2. The title should be strictly under {max_title_words} words.\n"
            "3. Use exact terminology from the data sources.\n"
            "4. Do NOT use these verbs: show, reveal, illustrate, analyze.\n"
            "5. ONLY return the title as a string, no extra text."
        )
        response_title = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI assistant that generates infographic titles."},
                {"role": "user", "content": title_prompt}
            ]
        )
        generated_title = response_title.choices[0].message.content
        generated_title = generated_title.strip() if generated_title else ""

        description_prompt = (
            f"{example_text}\n"
            "Based on the above examples (if any), please generate a precise DESCRIPTION for the following data.\n"
            f"{retrieved_text}\n\n"
            "Important instructions:\n"
            "1. The description should focus solely on what the data is about, without analyzing specific "
            "data characteristics, trends, distributions, or comparisons.\n"
            "2. Do NOT describe statistical properties (e.g., highest/lowest values, changes over time, "
            "ratios, percentages of difference). Instead, simply summarize what the dataset is reporting.\n"
            "3. Use one of the following structured templates where applicable, selecting the "
            "highest-priority option that fits the data. The templates are ranked in order of priority.\n"
            "   - **(Most Preferred) Share/Percentage of [group] (who [action/characteristic]) (by [region/timeframe] (in [units])).**\n"
            "   - Number/Total/Amount of [entity] (in [region/timeframe]) (, measured in [units]).\n"
            "   - Top/Leading N [entities] by [indicator] (, in [timeframe/region]).\n"
            "   - [Indicator] for [group/topic] (in [region/timeframe]) (, measured in [units]).\n"
            f"4. The description should be strictly under {max_description_words} words.\n"
            "5. Use exact terminology from the data sources.\n"
            "6. Do NOT use these verbs: show, reveal, illustrate, analyze.\n"
            "7. Avoid subjective statements (e.g., 'An analysis of...'). Focus on main metrics: Share, Rate, Number, Percentage.\n"
            "8. ONLY return the description as a string, no extra text."
        )
        response_description = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI assistant that generates infographic descriptions."},
                {"role": "user", "content": description_prompt}
            ]
        )
        generated_description = response_description.choices[0].message.content
        generated_description = generated_description.strip() if generated_description else ""

        return generated_title, generated_description

    def clear_faiss_data(self) -> None:
        """Remove existing FAISS index and training data from disk."""
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.data_path):
            os.remove(self.data_path)
        self.index = None
        self.training_data = []
        print("Original FAISS has been cleared.")

    def evaluate(
        self,
        topk_list: List[int],
        metrics: str = "bert-score",
        output_file: str = ""
    ) -> None:
        """Evaluate model performance on the validation set using either BERT-score or BLEU-4.

        Args:
            topk_list (List[int]): List of top-k values for retrieving examples.
            metrics (str, optional): "bert-score" or "BLEU-4". Defaults to "bert-score".
            output_file (str, optional): If provided, append evaluation results to this file.

        Raises:
            TypeError: If topk_list is not a list of ints.
            ValueError: If metrics is not one of ["bert-score", "BLEU-4"].
        """
        if not self.val_data:
            print("evaluate 失败，因为无验证集")
            return

        if not isinstance(topk_list, list) or not all(isinstance(i, int) for i in topk_list):
            raise TypeError("topk_list must be list of int.")

        if not isinstance(metrics, str) or metrics not in ["bert-score", "BLEU-4"]:
            raise ValueError("metrics only supports 'bert-score' or 'BLEU-4'.")
        
        references_title = []
        references_description = []
        for sample_input in self.val_data:
            # Ground Truth
            gt_title = sample_input[1].get(self.key_title, "")
            gt_title = gt_title if gt_title else ""
            gt_description = sample_input[1].get(self.key_description, "")
            gt_description = gt_description if gt_description else ""
            references_title.append(gt_title)
            references_description.append(gt_description)

        for topk in topk_list:
            predictions_rag_title = []
            predictions_rag_description = []
            for sample_input in tqdm(self.val_data, desc=f"Generating topk={topk} answers"):
                rag_title, rag_desc = self.generate_title_description(sample_input, topk=topk)
                predictions_rag_title.append(rag_title)
                predictions_rag_description.append(rag_desc)

            if metrics == "BLEU-4":
                references_title_wrapped = [[ref.split()] for ref in references_title]
                predictions_rag_title_wrapped = [pred.split() for pred in predictions_rag_title]
                title_score = corpus_bleu(references_title_wrapped, predictions_rag_title_wrapped,
                                          weights=(0.25, 0.25, 0.25, 0.25))

                references_desc_wrapped = [[ref.split()] for ref in references_description]
                predictions_rag_desc_wrapped = [pred.split() for pred in predictions_rag_description]
                description_score = corpus_bleu(references_desc_wrapped, predictions_rag_desc_wrapped,
                                                weights=(0.25, 0.25, 0.25, 0.25))
            else:
                _, _, title_F1 = score(
                    predictions_rag_title, references_title,
                    model_type="/data1/lizhen/roberta-large",
                    num_layers=17,
                    rescale_with_baseline=True,
                    lang="en", verbose=False
                )
                _, _, description_F1 = score(
                    predictions_rag_description, references_description,
                    model_type="/data1/lizhen/roberta-large",
                    num_layers=17,
                    rescale_with_baseline=True,
                    lang="en", verbose=False
                )
                title_score = title_F1.mean().item()
                description_score = description_F1.mean().item()

            print(f"[Evaluation] RAG (topk={topk}) {metrics}_title: {title_score:.4f}")
            print(f"[Evaluation] RAG (topk={topk}) {metrics}_description: {description_score:.4f}")
            if output_file and os.path.exists(output_file):
                with open(output_file, "a", encoding="utf-8") as file:
                    file.write(f"[Evaluation] RAG (topk={topk}) {metrics}_title: {title_score:.4f}\n")
                    file.write(f"[Evaluation] RAG (topk={topk}) {metrics}_description: {description_score:.4f}\n")
                    file.write("\n")

    def generate_json_with_data_facts(
        self,
        json_path: str,
        mode: str,
        output_path: str = "./data_with_data_facts.json",
        temp_path: str = "./temp_data_facts.json"
    ) -> str:
        """Generate a new JSON file containing 'data_facts' for each entry.

        Args:
            json_path (str): Path to the input JSON file.
            mode (str): "LLM" or "rules" for generating data facts.
            output_path (str, optional): Path to store the updated JSON file. Defaults to "./data_with_data_facts.json".
            temp_path (str, optional): Temporary path to store partial updates. Defaults to "./temp_data_facts.json".

        Raises:
            ValueError: If mode is not "LLM" or "rules".

        Returns:
            str: The path to the final updated JSON file.
        """
        if mode not in ["LLM", "rules"]:
            raise ValueError("mode must be 'LLM' or 'rules'。")

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        updated_data = {}
        for key, details in tqdm(data.items(), desc="Creating JSON file with data_facts"):
            text = self.process_single_data((key, details), need_content=False, need_main_insight=True)

            if mode == "LLM":
                data_facts = self.get_data_facts_by_LLM(text)
            else:
                data_facts = self.get_data_facts_by_rules(text)

            details[self.key_data_facts] = data_facts
            updated_data[key] = details

            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(updated_data, f, ensure_ascii=False, indent=4)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(updated_data, f, ensure_ascii=False, indent=4)

        print(f"JSON with data_facts has been saved to: {output_path}")
        return output_path

    def get_data_facts_by_LLM(self, input_text: str) -> Union[str, List[str]]:
        """Use an LLM to identify data facts from the given text.

        Args:
            input_text (str): A string representation of the chart data.

        Returns:
            Union[str, List[str]]: Parsed JSON array of data facts if successful; otherwise a raw string.
        """
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
            "reference name. For example, the merging result of \"China's "
            "population increased\" and \"India's population increased\" is "
            "\"China and India's population increased.\"\n"
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
            "\n"
            "Please review the chart data below and identify no more than five of the most significant data facts, "
            "ranking them in order of importance. The n-tuple format above specifies the elements you need "
            "to include, but your response does not need to strictly follow the tuple. Instead, "
            "describe each data fact in natural language while ensuring that your description "
            "includes each element from the n-tuple. "
            "If no facts are found, output an empty JSON array. Otherwise, output a JSON array of strings, "
            "with each string representing one fact. For example:\n"
            "[\n"
            "\"Country A is 20% higher compared to Country B.\",\n"
            "\"The sales showed a downward trend between 2010 and 2022, decreasing by 10%.\"\n"
            "]\n"
            "\n"
            "Sample data:\n"
            f"{input_text}\n"
            "\n"
            "Please respond with a JSON array of data facts in natural language. Note: DO NOT add ```json at the "
            "beginning of your output or ``` at the end. Follow the format of the example above!"
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

        final_data_facts = generated_text
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

    def get_data_facts_by_rules(self, input_text: str) -> List[str]:
        """Not implemeted yet, maybe never."""
        return


if __name__ == "__main__":
    import time
    time1 = time.time()
    RTG = RagTitleGenerator(json_path="/home/lizhen/ChartPipeline/src/processors/title_generator_modules/data_with_data_facts.json",
                            train_ratio=0.9)
    print("Init time:", time.time() - time1)
    
    RTG.clear_faiss_data()
    RTG.process_json()
    print("Process JSON time:", time.time() - time1)

    RTG.evaluate(topk_list=[9], metrics="BLEU-4")
    RTG.evaluate(topk_list=[9], metrics="bert-score")

    print("Total time:", time.time() - time1)

