from setuptools import setup, find_packages

setup(
    name="tigershark",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "numpy>=2.2.0",
        "setuptools>=65.7.0",
    ],
    python_requires=">=3.10",
    author="Tarpon Team",
    description="Tigershark package for Tarpon",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
