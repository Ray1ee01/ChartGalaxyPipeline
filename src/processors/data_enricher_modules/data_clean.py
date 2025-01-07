import pandas as pd
import numpy as np
import re

def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # drop error data
    for column in df.columns:
        if df[column].isnull().all():
            df.drop(columns=[column], inplace=True)
    df = df.replace('', np.nan)
    df = df.dropna(axis=0, how='all')

    # drop duplicate columns
    columns_to_drop = []
    for i in range(len(df.columns)):
        for j in range(i + 1, len(df.columns)):
            col1 = df.columns[i]
            col2 = df.columns[j]
            if df[col1].equals(df[col2]) and col1 == col2:
                columns_to_drop.append(col2)

            elif col1 == col2 and not df[col1].equals(df[col2]):
                new_col_name = f"{col2}_d"
                k = 1
                while new_col_name in df.columns:
                    new_col_name = f"{col2}_d_{k}"
                    k += 1
                df.rename(columns={col2: new_col_name}, inplace=True)
    df.drop(columns=columns_to_drop, inplace=True)
    
    # rule base clean
    for column in df.columns:
        if df[column].apply(lambda x: bool(re.match(r"^\s*\$\s*[\d\'.]+$", str(x)))).all():
            df[column] = df[column].apply(lambda x: re.sub(r"\s*\$\s*", "", str(x)).strip()).str.replace("'", "")
            # df.rename(columns={column: f"{column}(USD)"}, inplace=True)
    # from IPython import embed; embed(); exit()
    return df