"""The dishes the classifier is planned to recognise.

`slug` is the class label the model will output. Keep this list in the same
order as the model's output layer once it is trained.
"""

from typing import TypedDict


class Dish(TypedDict):
    slug: str
    name: str
    tagline: str
    description: str
    ingredients: list[str]
    spice: int  # 0 (mild) to 3 (fiery)
    region: str
    kind: str


DISHES: list[Dish] = [
    {
        "slug": "ema_datshi",
        "name": "Ema Datshi",
        "tagline": "The national dish",
        "description": (
            "Green or red chillies simmered with datshi, a soft farmer's cheese, until the "
            "sauce turns rich and creamy. Eaten almost daily across Bhutan, usually with red rice."
        ),
        "ingredients": ["Chillies", "Datshi cheese", "Onion", "Tomato", "Garlic"],
        "spice": 3,
        "region": "Nationwide",
        "kind": "Stew",
    },
    {
        "slug": "kewa_datshi",
        "name": "Kewa Datshi",
        "tagline": "Potatoes in cheese",
        "description": (
            "Sliced potatoes cooked in a buttery cheese sauce with a little chilli. "
            "A gentler cousin of Ema Datshi and a favourite with children."
        ),
        "ingredients": ["Potato", "Datshi cheese", "Chilli", "Butter", "Onion"],
        "spice": 1,
        "region": "Nationwide",
        "kind": "Stew",
    },
    {
        "slug": "shamu_datshi",
        "name": "Shamu Datshi",
        "tagline": "Mushrooms in cheese",
        "description": (
            "Mushrooms stewed with datshi and chilli. In the monsoon it is made with "
            "mushrooms foraged from the forests."
        ),
        "ingredients": ["Mushroom", "Datshi cheese", "Chilli", "Butter"],
        "spice": 2,
        "region": "Nationwide",
        "kind": "Stew",
    },
    {
        "slug": "phaksha_paa",
        "name": "Phaksha Paa",
        "tagline": "Pork with dried chillies",
        "description": (
            "Strips of pork, often with the fat, stir-fried and stewed with dried red "
            "chillies and radish or bok choy."
        ),
        "ingredients": ["Pork", "Dried red chillies", "Radish", "Ginger"],
        "spice": 3,
        "region": "Nationwide",
        "kind": "Meat",
    },
    {
        "slug": "jasha_maru",
        "name": "Jasha Maru",
        "tagline": "Spicy minced chicken",
        "description": (
            "Diced chicken cooked with tomato, garlic, ginger and chilli into a loose, "
            "brothy stew that is spooned over rice."
        ),
        "ingredients": ["Chicken", "Tomato", "Ginger", "Garlic", "Chilli"],
        "spice": 2,
        "region": "Nationwide",
        "kind": "Meat",
    },
    {
        "slug": "shakam_paa",
        "name": "Shakam Paa",
        "tagline": "Dried beef with radish",
        "description": (
            "Air-dried beef stewed with dried chillies and radish. Drying meat is how "
            "households keep it through the winter."
        ),
        "ingredients": ["Dried beef", "Dried chillies", "Radish"],
        "spice": 3,
        "region": "Nationwide",
        "kind": "Meat",
    },
    {
        "slug": "momo",
        "name": "Momo",
        "tagline": "Steamed dumplings",
        "description": (
            "Pleated dumplings filled with cheese, cabbage, pork or beef, steamed and "
            "served with ezay, a fiery chilli sauce."
        ),
        "ingredients": ["Wheat flour", "Cabbage", "Cheese or meat", "Ezay"],
        "spice": 1,
        "region": "Nationwide",
        "kind": "Dumpling",
    },
    {
        "slug": "hoentay",
        "name": "Hoentay",
        "tagline": "Buckwheat dumplings of Haa",
        "description": (
            "Dark buckwheat dumplings stuffed with turnip greens, cheese and spices, "
            "steamed or pan-fried. A Lomba (new year) speciality from the Haa valley."
        ),
        "ingredients": ["Buckwheat flour", "Turnip greens", "Cheese", "Butter"],
        "spice": 1,
        "region": "Haa",
        "kind": "Dumpling",
    },
    {
        "slug": "puta",
        "name": "Puta",
        "tagline": "Buckwheat noodles of Bumthang",
        "description": (
            "Hand-pressed buckwheat noodles tossed with mustard oil, butter and spring "
            "onion. Bumthang's high valleys grow buckwheat where rice will not."
        ),
        "ingredients": ["Buckwheat", "Mustard oil", "Spring onion", "Chilli"],
        "spice": 1,
        "region": "Bumthang",
        "kind": "Noodles",
    },
]

DISH_SLUGS = frozenset(dish["slug"] for dish in DISHES)
DISH_BY_SLUG = {dish["slug"]: dish for dish in DISHES}
