export const COURSE_STATES = {
  0: "purchased",
  1: "activated",
  2: "deactivated",
  3: "delivered",
  4: "completed",
};

export const normalizeOwnedCourse = (web3) => (course, ownedCourse) => {
  console.log("OwnedfromHEre", ownedCourse);
  return {
    ...course,
    ownedCourseId: ownedCourse.id,
    proof: ownedCourse.proof,
    owned: ownedCourse.owner,
    price: web3.utils.fromWei(ownedCourse.price),
    state: COURSE_STATES[ownedCourse.state],
  };
};
