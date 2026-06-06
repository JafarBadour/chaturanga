"""Portable NULL ordering (MySQL does not support NULLS FIRST/LAST)."""

from sqlalchemy import case


def nulls_first_col(column, *, asc: bool = True):
    null_key = case((column.is_(None), 0), else_=1)
    sort = column.asc() if asc else column.desc()
    return null_key, sort


def nulls_last_col(column, *, asc: bool = True):
    null_key = case((column.is_(None), 1), else_=0)
    sort = column.asc() if asc else column.desc()
    return null_key, sort
