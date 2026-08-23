from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class UrbanScore(Base):
    """SCORES group - the 11 derived scores per grid cell."""

    __tablename__ = "urban_scores"

    grid_id = Column(Integer, ForeignKey("urban_grid_master.grid_id"), primary_key=True)
    heat_score = Column(Float)
    walkability_score = Column(Float)
    traffic_score = Column(Float)
    flood_score = Column(Float)
    air_quality_score = Column(Float)
    accessibility_score = Column(Float)
    transit_score = Column(Float)
    services_score = Column(Float)
    environment_score = Column(Float)
    urban_usability_score = Column(Float)
    usability_class = Column(String(30))

    grid = relationship("UrbanGridMaster", back_populates="scores")


SCORE_COLUMNS = [
    "heat_score", "walkability_score", "traffic_score", "flood_score",
    "air_quality_score", "accessibility_score", "transit_score",
    "services_score", "environment_score", "urban_usability_score", "usability_class",
]