import Image from "next/image";
import { useOwnedCourses, useWalletInfo } from "@components/hooks/web3";
import { getAllCourses } from "@content/courses/fetcher";
import { Button, Loader } from "@components/ui/common";
import { useState } from "react";
import { OrderModal } from "@components/ui/order";
import { useWeb3 } from "@components/providers";
import { withToast } from "@utils/toast";

function purchaseButton(course) {
  const { data } = getAllCourses();
  const { hasConnectedWallet, account } = useWalletInfo();
  const { ownedCourses } = useOwnedCourses(data, account.data);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const owned = ownedCourses.lookup[course.id];

  const { web3, contract, requireInstall } = useWeb3();
  const [busyCourseId, setBusyCourseId] = useState(null);
  const [isNewPurchase, setIsNewPurchase] = useState(true);

  const purchaseCourse = async (order, course) => {
    const hexCourseId = web3.utils.utf8ToHex(course.id);
    const orderHash = web3.utils.soliditySha3(
      { type: "bytes16", value: hexCourseId },
      { type: "address", value: account.data }
    );

    const value = web3.utils.toWei(String(order.price));

    setBusyCourseId(course.id);
    if (isNewPurchase) {
      const emailHash = web3.utils.sha3(order.email);
      const proof = web3.utils.soliditySha3(
        { type: "bytes32", value: emailHash },
        { type: "bytes32", value: orderHash }
      );

      withToast(_purchaseCourse({ hexCourseId, proof, value }, course));
    } else {
      withToast(_repurchaseCourse({ courseHash: orderHash, value }, course));
    }
  };

  const _repurchaseCourse = async ({ courseHash, value }, course) => {
    try {
      const result = await contract.methods
        .repurchaseCourse(courseHash)
        .send({ from: account.data, value });

      const index = ownedCourses.data.findIndex((c) => c.id === course.id);

      if (index >= 0) {
        ownedCourses.data[index].state = "purchased";
        ownedCourses.mutate(ownedCourses.data);
      } else {
        ownedCourses.mutate();
      }
      return result;
    } catch (error) {
      throw new Error(error.message);
    } finally {
      setBusyCourseId(null);
    }
  };

  const _purchaseCourse = async ({ hexCourseId, proof, value }, course) => {
    try {
      const result = await contract.methods
        .purchaseCourse(hexCourseId, proof)
        .send({ from: account.data, value });

      ownedCourses.mutate([
        ...ownedCourses.data,
        {
          ...course,
          proof,
          state: "purchased",
          owner: account.data,
          price: value,
        },
      ]);
      return result;
    } catch (error) {
      throw new Error(error.message);
    } finally {
      setBusyCourseId(null);
    }
  };
  console.log("owned", owned);
  console.log("ownedCourse", ownedCourses);
  console.log("courseID", course.id);
  console.log("Course", course);
  const cleanupModal = () => {
    setSelectedCourse(null);
    setIsNewPurchase(true);
  };

  const ChangeStatetoDelivered = async (course) => {
    const hexCourseId = web3.utils.utf8ToHex(course.id);
    const orderHash = web3.utils.soliditySha3(
      { type: "bytes16", value: hexCourseId },
      { type: "address", value: account.data }
    );
    withToast(_delivered({ courseHash: orderHash }, course));
  };

  const _delivered = async ({ courseHash }, course) => {
    try {
      const result = await contract.methods
        .courseDelivered(courseHash)
        .send({ from: account.data });

      ownedCourses.mutate([
        ...ownedCourses.data,
        {
          ...course,
          state: "delivered",
        },
      ]);
      console.log("Owned1", ownedCourses);
      return result;
    } catch (error) {
      throw new Error(error.message);
    } finally {
      setBusyCourseId(null);
    }
  };

  const isBusy = busyCourseId === course.id;
  if (owned) {
    return (
      <>
        <div className="flex">
          {(course.state == "completed" || course.state == "delivered") && (
            <Button
              // onClick={() => alert("You are owner of this course.")}
              disabled={false}
              size="sm"
              variant="white"
            >
              Yours &#10004;
            </Button>
          )}
          {owned.state === "deactivated" && (
            <div className="ml-1">
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  setIsNewPurchase(false);
                  setSelectedCourse(course);
                }}
                variant="green"
              >
                {isBusy ? (
                  <div className="flex">
                    <Loader size="sm" />
                    <div className="ml-2">In Progress</div>
                  </div>
                ) : (
                  <div>
                    Your order has been Canceled. Your Money is already reverted
                    back to you.
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>{" "}
        &nbsp;&nbsp;
        {course.state == "activated" ? (
          <div>
            <Button
              onClick={() => ChangeStatetoDelivered(course)}
              size="sm"
              disabled={!hasConnectedWallet || isBusy}
              variant="green"
            >
              {" "}
              Received{" "}
            </Button>
          </div>
        ) : (
          <div></div>
        )}
      </>
    );
  }

  return (
    <>
      {" "}
      <Button
        onClick={() => setSelectedCourse(course)}
        size="sm"
        disabled={!hasConnectedWallet || isBusy}
        variant="lightPurple"
      >
        {isBusy ? (
          <div className="flex">
            <Loader size="sm" />
            <div className="ml-2">In Progress</div>
          </div>
        ) : (
          <div>Purchase</div>
        )}
      </Button>
      {selectedCourse && (
        <OrderModal
          course={selectedCourse}
          isNewPurchase={isNewPurchase}
          onSubmit={(formData, course) => {
            purchaseCourse(formData, course);
            cleanupModal();
          }}
          onClose={cleanupModal}
        />
      )}{" "}
    </>
  );

  // if (course.hasOwner) {
  //   return (
  //     <>
  //       <div className="flex">
  //         <Button
  //           onClick={() => alert("You are owner of this course.")}
  //           disabled={false}
  //           size="sm"
  //           variant="white"
  //         >
  //           Yours &#10004;
  //         </Button>
  //       </div>
  //     </>
  //   );
  // }

  // return (
  //   <>
  //     <Button
  //       onClick={() => setSelectedCourse(course)}
  //       size="sm"
  //       disabled={!hasConnectedWallet}
  //       variant="lightPurple"
  //     >
  //       <div>Purchase</div>
  //     </Button>
  //     {selectedCourse && (
  //       <OrderModal
  //         course={selectedCourse}
  //         isNewPurchase={true}
  //         onSubmit={(formData, course) => {
  //           purchaseCourse(formData, course);
  //           cleanupModal();
  //         }}
  //         onClose={cleanupModal}
  //       />
  //     )}
  //   </>
  // );
}

export default function Hero(course) {
  return (
    <section>
      <div className="relative bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <svg
              className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon points="50,0 100,0 50,100 0,100" />
            </svg>
            <div className="relative pt-6 px-4 sm:px-6 lg:px-8"></div>
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                {(course.state == "completed" ||
                  course.state == "delivered") && (
                  <div className="text-xl inline-block p-4 py-2 rounded-full font-bold bg-green-200 text-green-700">
                    You are owner of:
                  </div>
                )}
                {course.state == "purchased" && (
                  <div className="text-xl inline-block p-4 py-2 rounded-full font-bold bg-yellow-200 text-black-700">
                    Your order is being shipped...
                  </div>
                )}
                {course.state == "activated" && (
                  <div className="text-xl inline-block p-4 py-2 rounded-full font-bold bg-red-200 text-black-700">
                    The product is delivered by them
                  </div>
                )}

                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">
                    {course.title.substring(0, course.title.length / 2)}
                  </span>
                  <span className="block text-indigo-600 xl:inline">
                    {course.title.substring(course.title.length / 2)}
                  </span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  {course.description}
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  {/* <div className="rounded-md shadow">
                    <a
                      href="#"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
                    >
                      Get started
                    </a>
                  </div> */}
                  {/* <div className="mt-3 sm:mt-0 sm:ml-3">
                    <a
                      href="#"
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:py-4 md:text-lg md:px-10"
                    >
                      Watch
                    </a>
                  </div> */}
                  {purchaseButton(course)}
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <Image
            className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full"
            src={course.image}
            alt={course.title}
            layout="fill"
          />
        </div>
      </div>
    </section>
  );
}
