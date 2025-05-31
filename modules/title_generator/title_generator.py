import os
import json
import faiss
import numpy as np
from tqdm import tqdm
import argparse
import logging
from typing import Any, Dict, List, Tuple, Union
from openai import OpenAI
from utils.model_loader import ModelLoader

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("RagTitleGenerator")

class RagTitleGenerator:
    """
    RagTitleGenerator is a class that handles both:
    1. Building/maintaining the FAISS index from a given dataset.
    2. Generating infographic titles and descriptions for a single data item using RAG.
    """

    def __init__(
        self,
        index_path: str = "faiss_infographics.index",
        data_path: str = "infographics_data.npy",
        embed_model_path="",
        api_key: str="",
        base_url: str=""
    ) -> None:
        """
        Initialize the RagTitleGenerator. It attempts to load any existing FAISS index
        and corresponding training data from disk. If no index file is found, the index
        will be None until build_faiss_index is called.

        Args:
            index_path (str, optional): Path where the FAISS index file is or will be stored.
            data_path (str, optional): Path where the training data embeddings are stored.
            embed_model_path: Custom embedding model. If None, defaults to SentenceTransformer("all-MiniLM-L6-v2").
        """
        self.index_path = index_path
        self.data_path = data_path
        if embed_model_path:
            self.embed_model = ModelLoader.get_model(embed_model_path)
        else:
            print("fuck")
        #else:
        #    self.embed_model = SentenceTransformer("all-MiniLM-L6-v2")

        self.index = None
        self.training_data = []  # List of tuples: (input_text, title, description)

        print(api_key, base_url)
        self.client = OpenAI(
            api_key=api_key,
            # "sk-7TndhZHnyzdeSVpL4755335348B4425cB64bF8Ea80379073",
            base_url=base_url
            # "https://aihubmix.com/v1"
        )

        # Try loading an existing FAISS index and data
        if os.path.exists(self.index_path) and os.path.exists(self.data_path):
            print("Load existing FAISS index from disk.")
            self.index = faiss.read_index(self.index_path)
            with open(self.data_path, "rb") as f:
                self.training_data = np.load(f, allow_pickle=True).tolist()
        else:
            print("No existing FAISS index found; you can build a new one via build_faiss_index().")

    def build_faiss_index(self, data_json_path):
        """Build a FAISS index from a JSON dataset of chart data."""
        try:
            if not os.path.exists(data_json_path):
                raise ValueError(f"Provided data_json_path {data_json_path} does not exist.")

            # Remove existing index
            self.clear_faiss_data()

            # Load the entire dataset from JSON
            with open(data_json_path, "r", encoding="utf-8") as f:
                dataset = json.load(f)
            print("dataset", type(dataset))
            # Build the FAISS index from scratch
            if isinstance(dataset, dict):
                for name, details in tqdm(dataset.items(), desc="Building new FAISS index"):
                    processed_text = self.process_single_data(details)
                    title = details.get("metadata", {}).get("title", "")
                    description = details.get("metadata", {}).get("description", "")
                    self.add_training_data(processed_text, title, description)
            else:
                raise ValueError("Dataset must be a dictionary")

        except Exception as e:
            logger.error(f"处理记录时出错: {str(e)}")
            raise

    def clear_faiss_data(self) -> None:
        """Remove existing FAISS index and training data from disk."""
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.data_path):
            os.remove(self.data_path)
        self.index = None
        self.training_data = []
        print("Original FAISS has been cleared.")

    def process_single_data(
        self,
        data: Dict[str, Any]
    ) -> str:
        """
        Convert a single data dictionary into a textual representation for retrieval and generation.
        This includes metadata, chart_type, datafacts, etc.

        Args:
            data (Dict[str, Any]): A dictionary containing chart data, metadata, etc.

        Returns:
            str: A concatenated text representation of the data.
        """
        metadata = data.get("metadata", {})
        chart_type = data.get("chart_type", [])
        datafacts = data.get("datafacts", [])
        data_columns = data["data"].get("columns", [])
        chart_data = data["data"].get("data", [])

        main_insight = metadata.get("main_insight", "")

        # Convert chart type to text
        chart_type_text = "Chart Type: " + ", ".join(chart_type) + "\n" if chart_type else ""

        # Convert datafacts to text
        datafacts_text = "Data Facts:\n"
        if datafacts:
            for fact in datafacts:
                annotation = fact.get("annotation", "")
                if annotation:
                    datafacts_text += f"- {annotation}\n"
        else:
            datafacts_text = ""

        # Main insight
        main_insight_text = f"Main Insight: {main_insight}\n" if main_insight else ""

        # Data columns
        column_text = "Columns: "
        if data_columns:
            column_names = [col.get("name", "") for col in data_columns]
            # column_names = [f"{col.get('name', '')} ({col.get('description', '')})" for col in data_columns]
            column_text += ", ".join(column_names) + "\n"
        else:
            column_text = ""

        # Data sample (limit to first few rows)
        data_text = "Data Sample:\n"
        for row in chart_data:
            row_text = ", ".join([f"{k}: {v}" for k, v in row.items()])
            data_text += f"{row_text}\n"

        final_text = (
            f"{chart_type_text}\n"
            f"{datafacts_text}\n"
            f"{main_insight_text}\n"
            f"{column_text}\n"
            f"{data_text}"
        )
        return final_text

    def add_training_data(
        self,
        input_text: str,
        title: str,
        description: str
    ) -> None:
        """
        Add a single training sample into the in-memory list and FAISS index.
        After adding, it writes the updated index and data to disk.

        Args:
            input_text (str): Concatenated text derived from chart data.
            title (str): Ground truth or known title from the data's metadata.
            description (str): Ground truth or known description from the data's metadata.
        """
        self.training_data.append((input_text, title, description))

        embedding = self.embed_model.encode([input_text])

        if self.index is None:
            dim = embedding.shape[1]
            self.index = faiss.IndexFlatL2(dim)

        self.index.add(np.array(embedding))

        faiss.write_index(self.index, self.index_path)

        with open(self.data_path, "wb") as f:
            np.save(f, np.array(self.training_data, dtype=object))

    def retrieve_similar(
        self,
        new_input: str,
        topk: int = 7
    ) -> List[Tuple[str, str, str]]:
        """
        Retrieve the top-k most similar training samples from the FAISS index.

        Args:
            new_input (str): The new text query to encode.
            topk (int, optional): Number of similar samples to retrieve.

        Returns:
            List[Tuple[str, str, str]]: A list of (input_text, title, description).
        """
        if self.index is None or len(self.training_data) == 0:
            return []

        new_embedding = self.embed_model.encode([new_input])
        topk = min(topk, len(self.training_data))
        _, I = self.index.search(np.array(new_embedding), k=topk)

        retrieved_list = []
        for idx in I[0]:
            data = self.training_data[idx]
            retrieved_list.append((data[0], data[1], data[2]))

        return retrieved_list

    def generate_title_description(
        self,
        data: Dict[str, Any],
        topk: int = 7
    ) -> Tuple[str, str]:
        """
        Generate a title and subtitle for a single data dictionary using RAG.

        Args:
            data (Dict[str, Any]): The data dictionary containing metadata, chart_type, datafacts, etc.
            topk (int, optional): Number of similar examples to retrieve for prompt augmentation.

        Returns:
            Tuple[str, str]: (generated_title, generated_description)
        """
        processed_text = self.process_single_data(data)

        retrieved_examples = self.retrieve_similar(processed_text, topk=topk) if topk > 0 else []

        max_title_words = 8
        max_description_words = 13
        for _, rt, rd in retrieved_examples:
            rt = rt or ""
            rd = rd or ""
            max_title_words = max(max_title_words, len(rt.split()))
            max_description_words = max(max_description_words, len(rd.split()))

        example_text = ""
        if retrieved_examples:
            example_text += "Here are some similar examples:\n"
            for i, (r_data, rt, rd) in enumerate(retrieved_examples, start=1):
                example_text += (
                    f"\n[Similar Example {i}]\n"
                    f"Input Data:\n{r_data}\n"
                    f"Title: {rt if rt else ''}\n"
                    f"Description: {rd if rd else ''}\n"
                )
        title_prompt = (
            f"{example_text}\n"
            "Based on the above examples (if any), please generate a clear and concise TITLE for the following data.\n"
            f"{processed_text}\n\n"
            "Important instructions:\n"
            "1. The title should focus on the most significant feature of the data. "
            "You can choose one or more key insights from the Data Facts that best "
            "illustrate the issue, or identify the most notable feature yourself.\n"
            # "2. The title should focus solely on what the data is about, without analyzing specific "
            # "data characteristics, trends, distributions, or comparisons.\n"
            f"2. The title should be strictly under {max_title_words} words.\n"
            "3. Use exact terminology from the data sources.\n"
            "4. Do NOT use these verbs: show, reveal, illustrate, analyze.\n"
            "5. ONLY return the title as a string, no extra text."
        )

        response_title = self.client.chat.completions.create(
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
            f"{processed_text}\n\n"
            "Important instructions:\n"
            "1. Do NOT describe statistical properties (e.g., highest/lowest values, changes over time, "
            "ratios, percentages). Simply summarize what the dataset reports.\n"
            "2. Use one of the following structured templates where applicable (choose the highest-priority one that fits):\n"
            "   - Share/Percentage of [group] (who [action/characteristic]) (by [region/timeframe] (in [units])).\n"
            "   - Number/Total/Amount of [entity] (in [region/timeframe]) (, measured in [units]).\n"
            "   - Top/Leading N [entities] by [indicator] (, in [timeframe/region]).\n"
            "   - [Indicator] for [group/topic] (in [region/timeframe]) (, measured in [units]).\n"
            f"3. The description should be strictly under {max_description_words} words.\n"
            "4. Use exact terminology from the data sources.\n"
            "5. Do NOT use these verbs: show, reveal, illustrate, analyze.\n"
            "6. ONLY return the description as a string, no extra text."
        )

        response_description = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an AI assistant that generates infographic descriptions."},
                {"role": "user", "content": description_prompt}
            ]
        )
        generated_description = response_description.choices[0].message.content
        generated_description = generated_description.strip() if generated_description else ""

        return generated_title, generated_description

def process(
    input: str = None,
    output: str = None,
    input_data: Dict = None,
    index_path: str = "faiss_infographics.index",
    data_path: str = "infographics_data.npy",
    topk: int = 7,
    embed_model_path = "",
    api_key: str="",
    base_url: str=""
) -> Union[bool, Dict]:
    """
    Process function for generating the title and subtitle for a single data object.

    Args:
        input (str, optional): Path to the input JSON file with a single data object.
        output (str, optional): Path to the output JSON file.
        input_data (Dict, optional): A single data dictionary (alternative to file input).
        index_path (str, optional): Path to the FAISS index file.
        data_path (str, optional): Path to the training data embeddings file.
        topk (int, optional): Number of similar examples to retrieve.

    Returns:
        Union[bool, Dict]:
          - If output is provided, returns True/False indicating success/failure.
          - Otherwise, returns the updated data dictionary with generated titles.
    """
    try:
        # Initialize the generator and load any existing index/data
        generator = RagTitleGenerator(
            index_path=index_path,
            data_path=data_path,
            embed_model_path=embed_model_path,
            api_key=api_key,
            base_url=base_url
        )

        # Load the single data object
        if input_data is None:
            if input is None:
                return False
            with open(input, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = input_data
        if output is None:
            output = input

        main_title, sub_title = generator.generate_title_description(data, topk=topk)

        if "titles" not in data:
            data["titles"] = {}
        data["titles"]["main_title"] = main_title
        data["titles"]["sub_title"] = sub_title

        if output:
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True

        return True

    except Exception as e:
        print(f"Error in title generation: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Title generator for chart data')
    parser.add_argument('--input', type=str, required=True, help='Input JSON file path (single data object).')
    parser.add_argument('--output', type=str, required=True, help='Output JSON file path.')
    parser.add_argument('--index_path', type=str, default='faiss_infographics.index', help='FAISS index file path.')
    parser.add_argument('--data_path', type=str, default='infographics_data.npy', help='Training data path.')
    parser.add_argument('--topk', type=int, default=3, help='Number of similar examples to retrieve.')
    parser.add_argument('--embed_model_path', type=str, default='', help='Sentence transformer path')
    parser.add_argument('--api_key', type=str, default='', help='API key for LLM.')
    parser.add_argument('--base_url', type=str, default='', help='Base URL for LLM.')

    args = parser.parse_args()

    success = process(
        input=args.input,
        output=args.output,
        index_path=args.index_path,
        data_path=args.data_path,
        topk=args.topk,
        embed_model_path=args.embed_model_path,
        api_key=args.api_key,
        base_url=args.base_url
    )

    if success:
        print("Title generation completed successfully.")
    else:
        print("Title generation failed.")


if __name__ == "__main__":
    main()
